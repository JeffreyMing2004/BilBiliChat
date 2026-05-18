import type { LiveMessage } from './message'

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

export interface DanmuConfig {
  roomId: string
  reconnectInterval: number
  maxMessages: number
}

export interface StatusSnapshot {
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

export type DanmuMessageItem = LiveMessage
