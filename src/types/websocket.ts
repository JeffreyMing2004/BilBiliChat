import type { LiveMessage } from './message'
import type { LiveProviderKind } from './live'

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

export interface RawDanmuCommand {
  cmd?: string
  data?: Record<string, unknown>
  info?: unknown[]
}

export interface AuthReplyPayload {
  code?: number
}

export interface ReconnectNotice {
  reconnectCount: number
  reconnectInSeconds: number
  reason: string
}

export interface ConnectionStatusPayload {
  status: ConnectionStatus
  statusText: string
  websocketState: string
  reconnectCount: number
  error?: string
}

export interface RoomConnectionOptions {
  roomId: number
  reconnectInterval: number
  autoReconnect: boolean
  providerKind?: LiveProviderKind
  openLiveIdentityCode?: string
}

export interface RoomConnectionState {
  roomId: string
  resolvedRoomId: number | null
  status: ConnectionStatus
  statusText: string
  websocketState: string
  popularity: number
  reconnectCount: number
  lastError: string
  messageCount: number
  autoScrollEnabled: boolean
}

export type DanmuMessageItem = LiveMessage
