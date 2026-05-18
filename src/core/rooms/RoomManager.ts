import { connectionManager } from '../connection/ConnectionManager'
import { eventBus } from '../events/EventBus'
import { createSystemNotice } from '../message/MessageFactory'
import { logDebug, logInfo, logWarn } from '../logger/Logger'
import { performanceMonitor } from '../performance/PerformanceMonitor'
import { pluginManager } from '../plugins/PluginManager'
import { recoveryManager } from '../recovery/RecoveryManager'
import { windowBridge } from '../windows/WindowBridge'
import { loadStorageItem, saveStorageItem, activeRoomStorageKey, roomsStorageKey } from '../../settings'
import { calculateTopContributors } from '../../services/rankingService'
import { resolveRoomId } from '../../services/roomService'
import { fetchStreamerProfile } from '../../services/streamerService'
import type { AppSettings } from '../../types/settings'
import type { ConnectionStatusPayload } from '../../types/websocket'
import type { LiveMessage } from '../../types/message'
import type { PersistedRoomSession, RoomSessionState } from '../../types/room'
import type { ActiveRoomEvent, RoomMessageEvent, RoomPatchEvent, RoomSyncSnapshot } from '../../windows/shared/types'

interface RoomManagerSnapshot {
  rooms: Record<string, RoomSessionState>
  roomOrder: string[]
  activeRoomId: string
}

type SnapshotListener = (snapshot: RoomManagerSnapshot) => void

function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

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
    providerKind: 'public',
    popularity: 0,
    reconnectCount: 0,
    lastError: '',
    messageCount: 0,
    connecting: false,
    messages: [],
    autoConnect: false,
    entryCount: 0,
    onlineCount: 0,
    wsLatency: 0,
    danmuWindowVisible: false,
    streamer: null,
    topContributors: [],
    openLive: null,
    openLiveDebugRecords: [],
  }
}

function restoreRoomSession(room: PersistedRoomSession): RoomSessionState {
  return {
    ...createRoomSession(room.roomIdInput),
    id: room.id,
    autoConnect: room.autoConnect,
  }
}

function serializeRooms(roomOrder: string[], rooms: Record<string, RoomSessionState>): PersistedRoomSession[] {
  return roomOrder.map((id) => ({
    id,
    roomIdInput: rooms[id]?.roomIdInput ?? '',
    autoConnect: rooms[id]?.autoConnect ?? false,
  }))
}

export class RoomManager {
  private rooms: Record<string, RoomSessionState> = {}
  private roomOrder: string[] = []
  private activeRoomId = ''
  private readonly listeners = new Set<SnapshotListener>()
  private readonly cleanups: Array<() => void> = []
  private initialized = false
  private settingsResolver: (() => AppSettings) | null = null
  private readonly isMainWindow = windowBridge.getCurrentWindowLabel() === 'main'

  setSettingsResolver(resolver: () => AppSettings): void {
    this.settingsResolver = resolver
  }

  get mainWindow(): boolean {
    return this.isMainWindow
  }

  private get settings(): AppSettings {
    if (!this.settingsResolver) {
      throw new Error('RoomManager 尚未配置 settingsResolver')
    }

    return this.settingsResolver()
  }

  private createSnapshot(): RoomManagerSnapshot {
    return clonePlain({
      rooms: this.rooms,
      roomOrder: this.roomOrder,
      activeRoomId: this.activeRoomId,
    })
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener)
    listener(this.createSnapshot())

    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): RoomManagerSnapshot {
    return this.createSnapshot()
  }

  private notify(): void {
    const snapshot = this.createSnapshot()
    performanceMonitor.updateRoomCount(this.roomOrder.length)
    recoveryManager.captureRooms(
      this.activeRoomId,
      this.roomOrder.map((id) => ({
        id,
        roomIdInput: this.rooms[id]?.roomIdInput ?? '',
        autoConnect: this.rooms[id]?.autoConnect ?? false,
        status: this.rooms[id]?.status ?? 'idle',
      })),
    )
    this.listeners.forEach((listener) => listener(snapshot))
  }

  private persistRooms(): void {
    if (!this.isMainWindow) {
      return
    }

    saveStorageItem(roomsStorageKey(), serializeRooms(this.roomOrder, this.rooms))
    saveStorageItem(activeRoomStorageKey(), this.activeRoomId)
  }

  private ensureRoomExists(): void {
    if (this.roomOrder.length > 0) {
      return
    }

    const room = createRoomSession()
    this.rooms[room.id] = room
    this.roomOrder = [room.id]
    this.activeRoomId = room.id
  }

  private updateRoom(roomKey: string, patch: Partial<RoomSessionState>, sync = true): void {
    const room = this.rooms[roomKey]
    if (!room) {
      return
    }

    this.rooms[roomKey] = {
      ...room,
      ...patch,
    }

    this.notify()

    if (sync && this.isMainWindow) {
      void windowBridge.emitRoomPatch({
        roomId: roomKey,
        patch: clonePlain(patch),
      })
    }
  }

  private emitSnapshot(): void {
    if (!this.isMainWindow) {
      return
    }

    void windowBridge.emitRoomsSnapshot(this.createSnapshot())
  }

  private createOpenLiveStreamer(roomKey: string, state: NonNullable<RoomSessionState['openLive']>): RoomSessionState['streamer'] {
    const current = this.rooms[roomKey]?.streamer

    return {
      roomId: state.anchorRoomId ?? current?.roomId ?? 0,
      shortId: current?.shortId ?? 0,
      uid: state.anchorUid ?? current?.uid ?? 0,
      name: state.anchorName || current?.name || 'OpenLive 主播',
      avatar: state.anchorAvatar || current?.avatar || '',
      cover: current?.cover ?? '',
      keyframe: current?.keyframe ?? '',
      title: current?.title ?? 'OpenLive 直播间',
      areaName: current?.areaName ?? '直播',
      parentAreaName: current?.parentAreaName ?? '直播',
      liveStatus: current?.liveStatus ?? 1,
      fansCount: current?.fansCount ?? 0,
      guardCount: current?.guardCount ?? 0,
      onlineCount: current?.onlineCount ?? 0,
    }
  }

  private addMessage(roomKey: string, message: LiveMessage, sync = true): void {
    const room = this.rooms[roomKey]
    if (!room) {
      return
    }

    room.messages.push(message)
    if (room.messages.length > this.settings.maxMessages) {
      room.messages.splice(0, room.messages.length - this.settings.maxMessages)
    }

    if (message.type === 'system' && message.systemKind === 'entry') {
      room.entryCount += 1
    }

    room.messageCount = room.messages.length
    room.topContributors = calculateTopContributors(room.messages)
    this.notify()

    if (sync && this.isMainWindow) {
      void windowBridge.emitRoomMessage({
        roomId: roomKey,
        message: clonePlain(message),
        maxMessages: this.settings.maxMessages,
      })
      void windowBridge.emitRoomPatch({
        roomId: roomKey,
        patch: {
          messageCount: room.messageCount,
          entryCount: room.entryCount,
          topContributors: clonePlain(room.topContributors),
        },
      })
    }
  }

  private async bindMainWindowEvents(): Promise<void> {
    this.cleanups.push(eventBus.on('MESSAGE', ({ roomKey, message }) => {
      void pluginManager.emitHook('onMessage', { roomKey, message })
      this.addMessage(roomKey, message)
    }))
    this.cleanups.push(eventBus.on('CONNECT', ({ roomKey, connection }) => {
      this.handleConnectionState(roomKey, connection)
    }))
    this.cleanups.push(eventBus.on('DISCONNECT', ({ roomKey, connection }) => {
      this.handleConnectionState(roomKey, connection)
    }))
    this.cleanups.push(eventBus.on('RECONNECT', ({ roomKey, notice }) => {
      this.addMessage(
        roomKey,
        createSystemNotice(
          `${notice.reason}，${notice.reconnectInSeconds} 秒后开始第 ${notice.reconnectCount} 次重连`,
          'warning',
          'RECONNECT',
        ),
      )
    }))
    this.cleanups.push(eventBus.on('POPULARITY_UPDATE', ({ roomKey, popularity, latency }) => {
      this.updateRoom(roomKey, {
        popularity,
        wsLatency: latency,
      })
    }))
    this.cleanups.push(eventBus.on('OPENLIVE_STATUS', ({ roomKey, state }) => {
      this.updateRoom(roomKey, {
        openLive: state,
        resolvedRoomId: state?.anchorRoomId ?? this.rooms[roomKey]?.resolvedRoomId ?? null,
        streamer: state ? this.createOpenLiveStreamer(roomKey, state) : this.rooms[roomKey]?.streamer ?? null,
      })
    }))
    this.cleanups.push(eventBus.on('OPENLIVE_DEBUG', ({ roomKey, record }) => {
      const room = this.rooms[roomKey]
      if (!room) {
        return
      }

      const nextRecords = [record, ...room.openLiveDebugRecords].slice(0, 80)
      this.updateRoom(roomKey, {
        openLiveDebugRecords: nextRecords,
      })
    }))
    this.cleanups.push(await windowBridge.listenDanmuReady(() => {
      this.emitSnapshot()
    }))
  }

  private async bindMirrorWindowEvents(): Promise<void> {
    this.cleanups.push(await windowBridge.listenRoomsSnapshot((snapshot: RoomSyncSnapshot) => {
      this.rooms = snapshot.rooms
      this.roomOrder = snapshot.roomOrder
      this.activeRoomId = snapshot.activeRoomId || snapshot.roomOrder[0] || ''
      this.notify()
    }))
    this.cleanups.push(await windowBridge.listenRoomPatch((payload: RoomPatchEvent) => {
      this.updateRoom(payload.roomId, payload.patch, false)
    }))
    this.cleanups.push(await windowBridge.listenRoomMessage((payload: RoomMessageEvent) => {
      this.addMessage(payload.roomId, payload.message, false)
    }))
    this.cleanups.push(await windowBridge.listenActiveRoom((payload: ActiveRoomEvent) => {
      this.setActiveRoom(payload.roomId, false)
    }))
    await windowBridge.emitDanmuReady()
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    const persistedRooms = loadStorageItem<PersistedRoomSession[]>(roomsStorageKey(), [])
    const storedActiveRoomId = loadStorageItem(activeRoomStorageKey(), '')

    persistedRooms.forEach((room) => {
      this.rooms[room.id] = restoreRoomSession(room)
    })
    this.roomOrder = persistedRooms.map((room) => room.id)
    this.activeRoomId = storedActiveRoomId
    this.ensureRoomExists()

    if (!this.rooms[this.activeRoomId]) {
      this.activeRoomId = this.roomOrder[0] ?? ''
    }

    if (this.isMainWindow) {
      await this.bindMainWindowEvents()
    } else {
      await this.bindMirrorWindowEvents()
    }

    this.initialized = true
    this.notify()
    logInfo('rooms', `RoomManager 初始化完成，当前窗口：${windowBridge.getCurrentWindowLabel()}`)

    if (this.isMainWindow) {
      this.roomOrder.forEach((roomKey) => {
        const room = this.rooms[roomKey]
        if (room?.autoConnect && room.roomIdInput.trim()) {
          void this.connectRoom(roomKey).catch((error) => {
            const message = error instanceof Error ? error.message : '自动恢复连接失败'
            logWarn('rooms', `自动恢复连接失败：${message}`)
          })
        }
      })
      this.emitSnapshot()
    }
  }

  private handleConnectionState(roomKey: string, connection: ConnectionStatusPayload): void {
    this.updateRoom(roomKey, {
      status: connection.status,
      statusText: connection.statusText,
      websocketState: connection.websocketState,
      providerKind: connection.providerKind ?? this.rooms[roomKey]?.providerKind ?? 'public',
      reconnectCount: connection.reconnectCount,
      lastError: connection.error ?? '',
      connecting: connection.status === 'connecting' || connection.status === 'reconnecting',
      openLive: connection.openLive ?? this.rooms[roomKey]?.openLive ?? null,
    })
  }

  addRoom(): void {
    const room = createRoomSession()
    this.rooms[room.id] = room
    this.roomOrder.push(room.id)
    this.activeRoomId = room.id
    this.persistRooms()
    this.notify()
    this.emitSnapshot()
  }

  moveRoom(roomKey: string, step: -1 | 1): void {
    const currentIndex = this.roomOrder.indexOf(roomKey)
    if (currentIndex < 0) {
      return
    }

    const targetIndex = currentIndex + step
    if (targetIndex < 0 || targetIndex >= this.roomOrder.length) {
      return
    }

    const nextOrder = [...this.roomOrder]
    const [room] = nextOrder.splice(currentIndex, 1)
    nextOrder.splice(targetIndex, 0, room)
    this.roomOrder = nextOrder
    this.persistRooms()
    this.notify()
    this.emitSnapshot()
  }

  setActiveRoom(roomKey: string, sync = true): void {
    if (!this.rooms[roomKey]) {
      return
    }

    this.activeRoomId = roomKey
    this.persistRooms()
    this.notify()

    if (sync && this.isMainWindow) {
      eventBus.emit('ROOM_SWITCH', { roomKey })
      void pluginManager.emitHook('onRoomSwitch', { roomKey })
      void windowBridge.emitActiveRoom({ roomId: roomKey })
    }
  }

  removeRoom(roomKey: string): void {
    if (this.isMainWindow) {
      connectionManager.disconnect(roomKey)
    }

    delete this.rooms[roomKey]
    this.roomOrder = this.roomOrder.filter((id) => id !== roomKey)
    if (this.activeRoomId === roomKey) {
      this.activeRoomId = this.roomOrder[0] ?? ''
    }

    this.ensureRoomExists()
    this.persistRooms()
    this.notify()
    this.emitSnapshot()
  }

  updateRoomInput(roomKey: string, roomIdInput: string): void {
    this.updateRoom(roomKey, { roomIdInput }, false)
    this.persistRooms()
    this.emitSnapshot()
  }

  async connectRoom(roomKey = this.activeRoomId): Promise<void> {
    if (!this.isMainWindow) {
      return
    }

    const room = this.rooms[roomKey]
    if (!room) {
      return
    }

    const inputRoomId = room.roomIdInput.trim()
    logInfo('rooms', `开始连接房间：roomKey=${roomKey} input=${inputRoomId || '(empty)'} provider=${this.settings.liveProvider}`)
    const isOpenLive = this.settings.liveProvider === 'open-live'
    if (!inputRoomId && !isOpenLive) {
      logWarn('rooms', `连接已取消：roomKey=${roomKey} 输入房间号为空`)
      throw new Error('请输入直播间号')
    }

    this.disconnectRoom(roomKey, false)
    this.updateRoom(roomKey, {
      status: 'connecting',
      statusText: '正在解析真实房间号',
      reconnectCount: 0,
      lastError: '',
      popularity: 0,
      connecting: true,
      autoConnect: true,
    })
    this.persistRooms()

    if (isOpenLive) {
      try {
        logDebug('rooms', `OpenLive 模式直接启动官方会话：roomKey=${roomKey} identityCodeLength=${this.settings.openLiveIdentityCode.trim().length}`)
        await connectionManager.connect(roomKey, {
          roomId: this.rooms[roomKey]?.resolvedRoomId ?? 0,
          reconnectInterval: 5,
          autoReconnect: this.settings.autoReconnect,
          providerKind: 'open-live',
          openLiveIdentityCode: this.settings.openLiveIdentityCode,
        })
        logInfo('rooms', `OpenLive 连接流程已交给 ConnectionManager：roomKey=${roomKey}`)
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : 'OpenLive 连接失败'
        this.updateRoom(roomKey, {
          status: 'error',
          statusText: message,
          websocketState: 'CLOSED',
          providerKind: 'open-live',
          lastError: message,
          connecting: false,
        })
        this.addMessage(roomKey, createSystemNotice(`OpenLive 连接失败：${message}`, 'error', 'CONNECT_ERROR'))
        logWarn('rooms', message)
        throw error
      } finally {
        this.updateRoom(roomKey, {
          connecting: false,
        })
      }
    }

    try {
      logDebug('rooms', `准备解析真实房间号：roomKey=${roomKey} input=${inputRoomId}`)
      const resolvedRoomId = await resolveRoomId(inputRoomId).catch((error) => {
        const message = error instanceof Error ? error.message : '直播间号解析失败'
        throw new Error(`真实房间号解析失败：${message}`)
      })
      logInfo('rooms', `真实房间号解析完成：roomKey=${roomKey} input=${inputRoomId} resolved=${resolvedRoomId}`)
      this.updateRoom(roomKey, {
        resolvedRoomId,
        statusText: '真实房间号解析成功',
      })

      logDebug('rooms', `准备拉取主播资料：roomKey=${roomKey} resolved=${resolvedRoomId}`)
      const profile = await fetchStreamerProfile(resolvedRoomId).catch((error) => {
        const message = error instanceof Error ? error.message : '主播信息获取失败'
        throw new Error(`主播资料加载失败：${message}`)
      })
      logInfo('rooms', `主播资料加载完成：roomKey=${roomKey} resolved=${resolvedRoomId} streamer=${profile.name}`)
      this.updateRoom(roomKey, {
        streamer: profile,
        onlineCount: profile.onlineCount,
      })

      logDebug('rooms', `准备交给 ConnectionManager：roomKey=${roomKey} resolved=${resolvedRoomId} provider=${this.settings.liveProvider}`)
      await connectionManager.connect(roomKey, {
        roomId: resolvedRoomId,
        reconnectInterval: 5,
        autoReconnect: this.settings.autoReconnect,
        providerKind: this.settings.liveProvider,
        openLiveIdentityCode: this.settings.openLiveIdentityCode,
      })

      logInfo('rooms', `房间 ${inputRoomId} 连接流程已交给 ConnectionManager`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接失败'
      const shouldFallback = this.settings.liveProvider === 'open-live'
      if (shouldFallback) {
        try {
          logWarn('rooms', `OpenLive 失败，准备回退 Public WS：roomKey=${roomKey} resolved=${this.rooms[roomKey]?.resolvedRoomId ?? 0} error=${message}`)
          this.addMessage(roomKey, createSystemNotice(`OpenLive 连接失败，已回退到 Public WS：${message}`, 'warning', 'OPENLIVE_FALLBACK'))
          await connectionManager.connect(roomKey, {
            roomId: this.rooms[roomKey]?.resolvedRoomId ?? 0,
            reconnectInterval: 5,
            autoReconnect: this.settings.autoReconnect,
            providerKind: 'public',
          })
          logInfo('rooms', `Public WS 回退成功：roomKey=${roomKey}`)
          return
        } catch (fallbackError) {
          const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : 'Public WS 回退失败'
          logWarn('rooms', fallbackMessage)
        }
      }
      this.updateRoom(roomKey, {
        status: 'error',
        statusText: message,
        websocketState: 'CLOSED',
        providerKind: this.settings.liveProvider,
        lastError: message,
        connecting: false,
      })
      this.addMessage(roomKey, createSystemNotice(`连接失败：${message}`, 'error', 'CONNECT_ERROR'))
      logWarn('rooms', message)
      throw error
    } finally {
      this.updateRoom(roomKey, {
        connecting: false,
      })
    }
  }

  disconnectRoom(roomKey = this.activeRoomId, updateAutoConnect = true): void {
    const room = this.rooms[roomKey]
    if (!room) {
      return
    }

    if (this.isMainWindow) {
      connectionManager.disconnect(roomKey)
    }

    this.updateRoom(roomKey, {
      status: 'disconnected',
      statusText: '连接已断开',
      websocketState: 'CLOSED',
      providerKind: room.providerKind,
      reconnectCount: 0,
      connecting: false,
      autoConnect: updateAutoConnect ? false : room.autoConnect,
    })
    this.persistRooms()
  }

  reconnectRoom(roomKey = this.activeRoomId): Promise<void> {
    return this.connectRoom(roomKey)
  }

  clearRoomMessages(roomKey = this.activeRoomId): void {
    const room = this.rooms[roomKey]
    if (!room) {
      return
    }

    room.messages = []
    room.messageCount = 0
    room.entryCount = 0
    room.topContributors = []
    this.notify()
    this.addMessage(roomKey, createSystemNotice('已清空弹幕列表', 'soft', 'CLEAR_MESSAGES'))
  }

  applyMessageLimit(limit: number): void {
    this.roomOrder.forEach((roomKey) => {
      const room = this.rooms[roomKey]
      if (!room || room.messages.length <= limit) {
        return
      }

      room.messages.splice(0, room.messages.length - limit)
      room.messageCount = room.messages.length
      room.topContributors = calculateTopContributors(room.messages)
    })
    this.notify()
  }

  destroy(): void {
    this.cleanups.forEach((cleanup) => cleanup())
    this.cleanups.length = 0
    if (this.isMainWindow) {
      connectionManager.destroy()
    }
    this.initialized = false
    logWarn('rooms', 'RoomManager 已销毁')
  }
}

export const roomManager = new RoomManager()
