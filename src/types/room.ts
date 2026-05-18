import type { ConnectionStatus } from './danmu'
import type { LiveMessage } from './message'

export interface PersistedRoomSession {
  id: string
  roomIdInput: string
}

export interface RoomSessionState {
  id: string
  roomIdInput: string
  resolvedRoomId: number | null
  status: ConnectionStatus
  statusText: string
  websocketState: string
  popularity: number
  reconnectCount: number
  lastError: string
  messageCount: number
  connecting: boolean
  messages: LiveMessage[]
}
