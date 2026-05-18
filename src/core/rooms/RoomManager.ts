import { connectionManager } from '../connection/ConnectionManager'
import { eventBus } from '../events/EventBus'
import { createSystemNotice } from '../message/MessageFactory'
import { logInfo, logWarn } from '../logger/Logger'
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
      reconnectCount: connection.reconnectCount,
      lastError: connection.error ?? '',
      connecting: connection.status === 'connecting' || connection.status === 'reconnecting',
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
    if (!inputRoomId) {
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

    try {
      const resolvedRoomId = await resolveRoomId(inputRoomId)
      this.updateRoom(roomKey, {
        resolvedRoomId,
        statusText: '真实房间号解析成功',
      })

      const profile = await fetchStreamerProfile(resolvedRoomId)
      this.updateRoom(roomKey, {
        streamer: profile,
        onlineCount: profile.onlineCount,
      })

      await connectionManager.connect(roomKey, {
        roomId: resolvedRoomId,
        reconnectInterval: 5,
        autoReconnect: this.settings.autoReconnect,
      })

      logInfo('rooms', `房间 ${inputRoomId} 连接流程已交给 ConnectionManager`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接失败'
      this.updateRoom(roomKey, {
        status: 'error',
        statusText: message,
        websocketState: 'CLOSED',
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
