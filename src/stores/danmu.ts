import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'

import { shouldFilterMessage } from '../filters'
import { getCurrentWindowLabel } from '../windows/shared/manager'
import {
  emitActiveRoom,
  emitDanmuReady,
  emitRoomMessage,
  emitRoomPatch,
  emitRoomsSnapshot,
  listenActiveRoom,
  listenDanmuReady,
  listenRoomMessage,
  listenRoomPatch,
  listenRoomsSnapshot,
} from '../windows/shared/bridge'
import { calculateTopContributors } from '../modules/ranking'
import { createRoomSession, moveRoomByStep, restoreRoomSession, serializeRooms } from '../modules/rooms'
import { fetchStreamerProfile, resolveRoomId } from '../modules/streamer'
import { activeRoomStorageKey, loadStorageItem, roomsStorageKey, saveStorageItem } from '../settings'
import { playMessageSound } from '../sound'
import { useSettingsStore } from './settings'
import type { ConnectionStatus, DanmuMessageItem, ReconnectNotice } from '../types/danmu'
import type { PersistedRoomSession, RoomSessionState } from '../types/room'
import type { LogRecord } from '../utils/logger'
import { logError, logInfo, logSuccess, logWarning, onLog } from '../utils/logger'
import { LiveDanmuSocket } from '../websocket'
import { createSystemNotice } from '../websocket/events'
import type { ActiveRoomEvent, RoomMessageEvent, RoomPatchEvent, RoomSyncSnapshot } from '../windows/shared/types'

function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export const useDanmuStore = defineStore('danmu', () => {
  const settingsStore = useSettingsStore()
  const windowLabel = getCurrentWindowLabel()
  const isMainWindow = windowLabel === 'main'
  const isDanmuWindow = windowLabel === 'danmu'
  const roomOrder = ref<string[]>([])
  const rooms = ref<Record<string, RoomSessionState>>({})
  const activeRoomId = ref('')
  const logs = ref<LogRecord[]>([])
  const initialized = ref(false)
  const autoScrollEnabled = ref(true)

  const sockets = new Map<string, LiveDanmuSocket>()
  const syncCleanups: Array<() => void> = []
  let unlistenLog: (() => void) | null = null

  const roomList = computed(() => roomOrder.value.map((id) => rooms.value[id]).filter(Boolean))
  const activeRoom = computed(() => rooms.value[activeRoomId.value] ?? null)
  const canConnectActive = computed(() => Boolean(activeRoom.value?.roomIdInput.trim()) && !activeRoom.value?.connecting)
  const isAutoScrollPaused = computed(() => !autoScrollEnabled.value)
  const activeStatus = computed(() => activeRoom.value?.status ?? 'idle')

  function bindLogger(): void {
    if (unlistenLog) {
      return
    }

    unlistenLog = onLog((record) => {
      logs.value.unshift(record)
      logs.value = logs.value.slice(0, 120)
    })
  }

  function createSnapshot(): RoomSyncSnapshot {
    return clonePlain({
      roomOrder: roomOrder.value,
      activeRoomId: activeRoomId.value,
      rooms: rooms.value,
    })
  }

  function emitSnapshot(): void {
    if (!isMainWindow) {
      return
    }

    void emitRoomsSnapshot(createSnapshot())
  }

  function persistRooms(): void {
    if (!isMainWindow) {
      return
    }

    saveStorageItem(roomsStorageKey(), serializeRooms(roomOrder.value, rooms.value))
    saveStorageItem(activeRoomStorageKey(), activeRoomId.value)
  }

  function ensureRoomExists(): void {
    if (roomOrder.value.length === 0) {
      const room = createRoomSession()
      rooms.value[room.id] = room
      roomOrder.value = [room.id]
      activeRoomId.value = room.id
      persistRooms()
      emitSnapshot()
    }
  }

  function syncRoomPatch(roomId: string, patch: Partial<RoomSessionState>): void {
    if (!isMainWindow) {
      return
    }

    void emitRoomPatch({
      roomId,
      patch: clonePlain(patch),
    })
  }

  function updateRoom(roomId: string, patch: Partial<RoomSessionState>, sync = true): void {
    const room = rooms.value[roomId]

    if (!room) {
      return
    }

    rooms.value[roomId] = {
      ...room,
      ...patch,
    }

    if (sync) {
      syncRoomPatch(roomId, patch)
    }
  }

  function recalculateRoomDerivedState(roomId: string): void {
    const room = rooms.value[roomId]

    if (!room) {
      return
    }

    room.messageCount = room.messages.length
    room.topContributors = calculateTopContributors(room.messages)
  }

  function addIncomingMessage(roomId: string, message: DanmuMessageItem, sync = true): void {
    const room = rooms.value[roomId]

    if (!room) {
      return
    }

    room.messages.push(message)

    if (room.messages.length > settingsStore.settings.maxMessages) {
      room.messages.splice(0, room.messages.length - settingsStore.settings.maxMessages)
    }

    if (message.type === 'system' && message.systemKind === 'entry') {
      room.entryCount += 1
    }

    recalculateRoomDerivedState(roomId)

    if (sync && isMainWindow) {
      void emitRoomMessage({
        roomId,
        message: clonePlain(message),
        maxMessages: settingsStore.settings.maxMessages,
      })
      syncRoomPatch(roomId, {
        messageCount: room.messageCount,
        topContributors: room.topContributors,
        entryCount: room.entryCount,
      })
    }

    if (
      isMainWindow
      && settingsStore.settings.soundEnabled
      && !shouldFilterMessage(
        message,
        settingsStore.settings,
        settingsStore.keywordFilters,
        settingsStore.userBlacklist,
      )
    ) {
      playMessageSound(message)
    }
  }

  function addSystemNotice(
    roomId: string,
    content: string,
    tone: 'soft' | 'normal' | 'warning' | 'error',
    rawCommand = 'SYSTEM',
  ): void {
    addIncomingMessage(roomId, createSystemNotice(content, tone, rawCommand))
  }

  function notifyStatusTransition(roomId: string, nextStatus: ConnectionStatus, statusText: string, error?: string): void {
    if (!isMainWindow || roomId !== activeRoomId.value) {
      return
    }

    if (nextStatus === 'connected') {
      ElMessage.success('连接成功，独立弹幕窗口已就绪')
    } else if (nextStatus === 'reconnecting') {
      ElMessage.warning(statusText)
    } else if (nextStatus === 'disconnected') {
      ElMessage.info('WebSocket 已断开')
    } else if (nextStatus === 'error') {
      ElMessage.error(error || statusText)
    }
  }

  async function bindWindowSync(): Promise<void> {
    if (syncCleanups.length > 0) {
      return
    }

    if (isMainWindow) {
      syncCleanups.push(await listenDanmuReady(() => {
        emitSnapshot()
      }))
      return
    }

    if (!isDanmuWindow) {
      return
    }

    syncCleanups.push(await listenRoomsSnapshot((snapshot) => {
      rooms.value = snapshot.rooms
      roomOrder.value = snapshot.roomOrder
      activeRoomId.value = snapshot.activeRoomId || snapshot.roomOrder[0] || ''
      autoScrollEnabled.value = true
    }))
    syncCleanups.push(await listenRoomPatch((payload: RoomPatchEvent) => {
      updateRoom(payload.roomId, payload.patch, false)
    }))
    syncCleanups.push(await listenRoomMessage((payload: RoomMessageEvent) => {
      addIncomingMessage(payload.roomId, payload.message, false)
    }))
    syncCleanups.push(await listenActiveRoom((payload: ActiveRoomEvent) => {
      setActiveRoom(payload.roomId, false)
    }))
    await emitDanmuReady()
  }

  async function initialize(): Promise<void> {
    if (initialized.value) {
      return
    }

    settingsStore.initialize()
    bindLogger()
    const persistedRooms = loadStorageItem<PersistedRoomSession[]>(roomsStorageKey(), [])
    const storedActiveRoomId = loadStorageItem(activeRoomStorageKey(), '')

    persistedRooms.forEach((room) => {
      rooms.value[room.id] = restoreRoomSession(room)
    })
    roomOrder.value = persistedRooms.map((room) => room.id)
    activeRoomId.value = storedActiveRoomId
    ensureRoomExists()

    if (!rooms.value[activeRoomId.value]) {
      activeRoomId.value = roomOrder.value[0]
    }

    await bindWindowSync()
    initialized.value = true
    logInfo('store', `多房间状态初始化完成，当前窗口：${windowLabel}`)

    if (isMainWindow) {
      roomList.value.forEach((room) => {
        if (room.autoConnect && room.roomIdInput.trim()) {
          void connectRoom(room.id)
        }
      })
      emitSnapshot()
    }
  }

  function addRoom(): void {
    const room = createRoomSession()
    rooms.value[room.id] = room
    roomOrder.value.push(room.id)
    activeRoomId.value = room.id
    autoScrollEnabled.value = true
    persistRooms()
    emitSnapshot()
  }

  function moveRoom(roomId: string, step: -1 | 1): void {
    roomOrder.value = moveRoomByStep(roomOrder.value, roomId, step)
    persistRooms()
    emitSnapshot()
  }

  function setActiveRoom(roomId: string, sync = true): void {
    if (!rooms.value[roomId]) {
      return
    }

    activeRoomId.value = roomId
    autoScrollEnabled.value = true

    if (isMainWindow) {
      persistRooms()
    }

    if (sync && isMainWindow) {
      void emitActiveRoom({ roomId })
    }
  }

  function removeRoom(roomId: string): void {
    disconnectRoom(roomId, false)
    delete rooms.value[roomId]
    roomOrder.value = roomOrder.value.filter((id) => id !== roomId)

    if (activeRoomId.value === roomId) {
      activeRoomId.value = roomOrder.value[0] ?? ''
    }

    ensureRoomExists()
    persistRooms()
    emitSnapshot()
  }

  function updateRoomInput(roomId: string, roomIdInput: string): void {
    updateRoom(roomId, { roomIdInput }, false)
    persistRooms()
    emitSnapshot()
  }

  async function hydrateStreamer(roomId: string, resolvedRoomId: number): Promise<void> {
    try {
      const profile = await fetchStreamerProfile(resolvedRoomId)
      updateRoom(roomId, {
        streamer: profile,
        onlineCount: profile.onlineCount,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '主播信息获取失败'
      logWarning('store', message)
    }
  }

  async function connectRoom(roomId = activeRoomId.value): Promise<void> {
    if (!isMainWindow) {
      return
    }

    const room = rooms.value[roomId]

    if (!room) {
      return
    }

    const inputRoomId = room.roomIdInput.trim()

    if (!inputRoomId) {
      ElMessage.warning('请输入直播间号')
      return
    }

    disconnectRoom(roomId, false)
    updateRoom(roomId, {
      status: 'connecting',
      statusText: '正在解析真实房间号',
      reconnectCount: 0,
      lastError: '',
      popularity: 0,
      connecting: true,
      autoConnect: true,
    })
    persistRooms()

    try {
      const resolvedRoomId = await resolveRoomId(inputRoomId)
      updateRoom(roomId, {
        resolvedRoomId,
        statusText: '真实房间号解析成功',
      })
      addSystemNotice(roomId, `已解析真实房间号：${resolvedRoomId}`, 'soft', 'ROOM_RESOLVED')
      logInfo('connection', `房间 ${inputRoomId} 解析成功: ${resolvedRoomId}`)
      await hydrateStreamer(roomId, resolvedRoomId)

      const socket = new LiveDanmuSocket({
        roomId: resolvedRoomId,
        reconnectInterval: 5,
        autoReconnect: settingsStore.settings.autoReconnect,
        onStatus: ({ status, statusText, websocketState, reconnectCount, error }) => {
          updateRoom(roomId, {
            status,
            statusText,
            websocketState,
            reconnectCount,
            lastError: error ?? '',
          })
          notifyStatusTransition(roomId, status, statusText, error)
        },
        onPopularity: (popularity) => {
          updateRoom(roomId, { popularity })
        },
        onLatency: (latency) => {
          updateRoom(roomId, { wsLatency: latency })
        },
        onMessage: (message) => {
          console.log(`[LiveDanmu][${message.rawCommand}]`, message.summary)
          addIncomingMessage(roomId, message)
        },
        onRawCommand: (payload) => {
          console.debug('[LiveDanmu][RAW]', payload.cmd ?? 'UNKNOWN', payload)
        },
        onReconnectScheduled: (notice: ReconnectNotice) => {
          handleReconnectNotice(roomId, notice)
        },
      })

      sockets.set(roomId, socket)
      await socket.connect()
      persistRooms()
      emitSnapshot()
      logSuccess('connection', `房间 ${inputRoomId} 已连接`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接失败'
      updateRoom(roomId, {
        status: 'error',
        statusText: message,
        websocketState: 'CLOSED',
        lastError: message,
      })
      addSystemNotice(roomId, `连接失败：${message}`, 'error', 'CONNECT_ERROR')
      logError('connection', message)

      if (roomId === activeRoomId.value) {
        ElMessage.error(message)
      }
    } finally {
      updateRoom(roomId, { connecting: false })
    }
  }

  function handleReconnectNotice(roomId: string, notice: ReconnectNotice): void {
    addSystemNotice(
      roomId,
      `${notice.reason}，${notice.reconnectInSeconds} 秒后开始第 ${notice.reconnectCount} 次重连`,
      'warning',
      'RECONNECT',
    )
    logWarning('websocket', `${notice.reason}，${notice.reconnectInSeconds} 秒后自动重连`)

    if (isMainWindow && roomId === activeRoomId.value) {
      ElMessage.warning('WebSocket 断开，正在自动重连')
    }
  }

  function disconnectRoom(roomId = activeRoomId.value, showToast = true): void {
    const room = rooms.value[roomId]
    const socket = sockets.get(roomId)

    socket?.disconnect()
    sockets.delete(roomId)

    if (!room) {
      return
    }

    updateRoom(roomId, {
      status: 'disconnected',
      statusText: '连接已断开',
      websocketState: 'CLOSED',
      reconnectCount: 0,
      connecting: false,
      autoConnect: false,
    })
    persistRooms()

    if (showToast && isMainWindow && roomId === activeRoomId.value) {
      ElMessage.info('WebSocket 已断开')
    }
  }

  function reconnectActiveRoom(): void {
    if (!activeRoom.value) {
      return
    }

    void connectRoom(activeRoom.value.id)
  }

  function clearActiveMessages(): void {
    if (!activeRoom.value) {
      return
    }

    updateRoom(activeRoom.value.id, {
      messages: [],
      messageCount: 0,
      entryCount: 0,
      topContributors: [],
    })
    addSystemNotice(activeRoom.value.id, '已清空弹幕列表', 'soft', 'CLEAR_MESSAGES')
  }

  function setAutoScrollEnabled(enabled: boolean): void {
    autoScrollEnabled.value = enabled
  }

  function applyMessageLimit(limit: number): void {
    roomOrder.value.forEach((roomId) => {
      const room = rooms.value[roomId]

      if (room.messages.length > limit) {
        room.messages.splice(0, room.messages.length - limit)
        recalculateRoomDerivedState(roomId)
        syncRoomPatch(roomId, {
          messages: room.messages,
          messageCount: room.messageCount,
          topContributors: room.topContributors,
        })
      }
    })
  }

  return {
    activeRoom,
    activeRoomId,
    activeStatus,
    autoScrollEnabled,
    canConnectActive,
    initialized,
    isAutoScrollPaused,
    isMainWindow,
    logs,
    roomList,
    roomOrder,
    rooms,
    addRoom,
    applyMessageLimit,
    clearActiveMessages,
    connectRoom,
    disconnectRoom,
    initialize,
    moveRoom,
    reconnectActiveRoom,
    removeRoom,
    setActiveRoom,
    setAutoScrollEnabled,
    updateRoomInput,
  }
})
