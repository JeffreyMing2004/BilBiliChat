export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

export type DanmuMessageType = 'danmu' | 'gift' | 'entry' | 'superChat' | 'system'

export interface DanmuMessageItem {
  id: string
  type: DanmuMessageType
  username: string
  userColor: string
  content: string
  timestamp: string
  rawCommand: string
  price?: number
  giftName?: string
  giftCount?: number
}

export interface DanmuConfig {
  roomId: string
  autoConnect: boolean
  maxMessages: number
  reconnectInterval: number
}

export interface LiveRoomInfo {
  roomId: number
  shortId: number
  title: string
  anchorName: string
  cover: string
  liveStatus: number
}

export interface DanmuHost {
  host: string
  port: number
  wssPort: number
}

export interface DanmuServerConfig {
  token: string
  hostList: DanmuHost[]
}

export interface StatusSnapshot {
  roomId: string
  resolvedRoomId: number | null
  title: string
  anchorName: string
  popularity: number
  currentHost: string
  status: ConnectionStatus
  statusText: string
  lastError: string
}

export interface BilibiliCommandPayload {
  cmd?: string
  data?: Record<string, unknown>
  info?: unknown[]
}
