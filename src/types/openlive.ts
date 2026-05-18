import type { RawDanmuCommand } from './websocket'

export type OpenLiveAuthStatus = 'idle' | 'validating' | 'authenticated' | 'failed'
export type OpenLiveSessionStatus = 'idle' | 'starting' | 'active' | 'ending' | 'ended' | 'recovering' | 'error'

export interface OpenLiveStateSnapshot {
  roomKey: string
  roomId: number
  identityCode: string
  identityCodeValid: boolean
  authStatus: OpenLiveAuthStatus
  sessionStatus: OpenLiveSessionStatus
  statusText: string
  anchorRoomId: number | null
  anchorName: string
  anchorUid: number | null
  anchorAvatar: string
  gameId: string
  websocketUrl: string
  websocketState: string
  heartbeatAlive: boolean
  lastHeartbeatAt: number
  lastHeartbeatReplyAt: number
  reconnectCount: number
  reconnectLimit: number
  tokenExpiresAt: number
  latency: number
  connected: boolean
  manualClose: boolean
  fallbackSuggested: boolean
  lastError: string
}

export interface OpenLiveDebugRecord {
  id: string
  createdAt: number
  roomKey: string
  type: 'raw' | 'protocol' | 'status' | 'error'
  command: string
  message: string
  payload?: RawDanmuCommand | Record<string, unknown> | string
}
