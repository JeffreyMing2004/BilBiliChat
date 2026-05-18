import type { PersistedRoomSession, RoomSessionState } from '../../types/room'

export function createRoomId(): string {
  return `room-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

export function createRoomSession(roomIdInput = ''): RoomSessionState {
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
    openLive: null,
    openLiveDebugRecords: [],
    topContributors: [],
  }
}

export function restoreRoomSession(room: PersistedRoomSession): RoomSessionState {
  return {
    ...createRoomSession(room.roomIdInput),
    id: room.id,
    autoConnect: room.autoConnect,
  }
}

export function serializeRooms(roomOrder: string[], rooms: Record<string, RoomSessionState>): PersistedRoomSession[] {
  return roomOrder.map((id) => ({
    id,
    roomIdInput: rooms[id]?.roomIdInput ?? '',
    autoConnect: rooms[id]?.autoConnect ?? false,
  }))
}

export function moveRoomByStep(roomOrder: string[], roomId: string, step: -1 | 1): string[] {
  const currentIndex = roomOrder.indexOf(roomId)

  if (currentIndex < 0) {
    return roomOrder
  }

  const targetIndex = currentIndex + step

  if (targetIndex < 0 || targetIndex >= roomOrder.length) {
    return roomOrder
  }

  const nextOrder = [...roomOrder]
  const [room] = nextOrder.splice(currentIndex, 1)
  nextOrder.splice(targetIndex, 0, room)
  return nextOrder
}
