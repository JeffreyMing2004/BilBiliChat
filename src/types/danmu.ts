export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

export type DanmuMessageType = 'danmu' | 'gift' | 'superChat' | 'entry' | 'system'

export interface DanmuMessageItem {
  id: string
  type: DanmuMessageType
  username: string
  content: string
  summary: string
  timestamp: string
  rawCommand: string
  price?: number
}

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
}

export interface RawDanmuCommand {
  cmd?: string
  data?: Record<string, unknown>
  info?: unknown[]
}

export interface AuthReplyPayload {
  code?: number
}
