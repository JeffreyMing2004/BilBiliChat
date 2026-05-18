import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'

import { resolveRoomId } from '../api/bilibili'
import { shouldFilterMessage } from '../filters'
import { activeRoomStorageKey, loadStorageItem, roomsStorageKey, saveStorageItem } from '../settings'
import { playMessageSound } from '../sound'
import { useSettingsStore } from './settings'
import type { ConnectionStatus, DanmuMessageItem, ReconnectNotice } from '../types/danmu'
import type { PersistedRoomSession, RoomSessionState } from '../types/room'
import type { LogRecord } from '../utils/logger'
import { logError, logInfo, logSuccess, logWarning, onLog } from '../utils/logger'
import { LiveDanmuSocket } from '../websocket'
import { createSystemNotice } from '../websocket/events'

function createRoomId(): string {
  return `room-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function createRoomSession(roomIdInput = ''): RoomSessionState {
  return {
    id: createRoomId(),
    roomIdInput,
    resolvedRoomId: null,
    status: 'idle',
    statusText: '等待连接',
    websocketState: 'CLOSED',
    popularity: 0,
    reconnectCount: 0,
    lastError: '',
    messageCount: 0,
    connecting: false,
    messages: [],
  }
}

function restoreRoomSession(room: PersistedRoomSession): RoomSessionState {
  return {
    ...createRoomSession(room.roomIdInput),
    id: room.id,
  }
}

export const useDanmuStore = defineStore('danmu', () => {
  const settingsStore = useSettingsStore()
  const roomOrder = ref<string[]>([])
  const rooms = ref<Record<string, RoomSessionState>>({})
  const activeRoomId = ref('')
  const logs = ref<LogRecord[]>([])
  const initialized = ref(false)
  const autoScrollEnabled = ref(true)

  const sockets = new Map<string, LiveDanmuSocket>()
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

  function persistRooms(): void {
    const persistedRooms = roomOrder.value.map((id) => ({
      id,
      roomIdInput: rooms.value[id]?.roomIdInput ?? '',
    }))

    saveStorageItem(roomsStorageKey(), persistedRooms)
    saveStorageItem(activeRoomStorageKey(), activeRoomId.value)
  }

  function ensureRoomExists(): void {
    if (roomOrder.value.length === 0) {
      const room = createRoomSession()
      rooms.value[room.id] = room
      roomOrder.value = [room.id]
      activeRoomId.value = room.id
      persistRooms()
    }
  }

  function updateRoom(roomId: string, patch: Partial<RoomSessionState>): void {
    const room = rooms.value[roomId]

    if (!room) {
      return
    }

    rooms.value[roomId] = {
      ...room,
      ...patch,
    }
  }

  function addIncomingMessage(roomId: string, message: DanmuMessageItem): void {
    const room = rooms.value[roomId]

    if (!room) {
      return
    }

    room.messages.push(message)

    if (room.messages.length > settingsStore.settings.maxMessages) {
      room.messages.splice(0, room.messages.length - settingsStore.settings.maxMessages)
    }

    room.messageCount = room.messages.length

    if (
      settingsStore.settings.soundEnabled
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
    if (roomId !== activeRoomId.value) {
      return
    }

    if (nextStatus === 'connected') {
      ElMessage.success('连接成功')
    } else if (nextStatus === 'reconnecting') {
      ElMessage.warning(statusText)
    } else if (nextStatus === 'disconnected') {
      ElMessage.info('WebSocket 已断开')
    } else if (nextStatus === 'error') {
      ElMessage.error(error || statusText)
    }
  }

  async function initialize(): Promise<void> {
    if (initialized.value) {
      return
    }

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

    initialized.value = true
    logInfo('store', '多房间状态初始化完成')
  }

  function addRoom(): void {
    const room = createRoomSession()
    rooms.value[room.id] = room
    roomOrder.value.push(room.id)
    activeRoomId.value = room.id
    autoScrollEnabled.value = true
    persistRooms()
  }

  function setActiveRoom(roomId: string): void {
    if (!rooms.value[roomId]) {
      return
    }

    activeRoomId.value = roomId
    autoScrollEnabled.value = true
    persistRooms()
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
  }

  function updateRoomInput(roomId: string, roomIdInput: string): void {
    updateRoom(roomId, { roomIdInput })
    persistRooms()
  }

  async function connectRoom(roomId = activeRoomId.value): Promise<void> {
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
    })

    try {
      const resolvedRoomId = await resolveRoomId(inputRoomId)
      updateRoom(roomId, {
        resolvedRoomId,
        statusText: '真实房间号解析成功',
      })
      addSystemNotice(roomId, `已解析真实房间号：${resolvedRoomId}`, 'soft', 'ROOM_RESOLVED')
      logInfo('connection', `房间 ${inputRoomId} 解析成功: ${resolvedRoomId}`)

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
      persistRooms()
      await socket.connect()
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

    if (roomId === activeRoomId.value) {
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
    })

    if (showToast && roomId === activeRoomId.value) {
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

    activeRoom.value.messages = []
    activeRoom.value.messageCount = 0
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
        room.messageCount = room.messages.length
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
    logs,
    roomList,
    rooms,
    addRoom,
    applyMessageLimit,
    clearActiveMessages,
    connectRoom,
    disconnectRoom,
    initialize,
    reconnectActiveRoom,
    removeRoom,
    setActiveRoom,
    setAutoScrollEnabled,
    updateRoomInput,
  }
})
