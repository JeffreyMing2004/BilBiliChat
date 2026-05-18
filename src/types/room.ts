import type { ConnectionStatus } from './danmu'
import type { LiveMessage } from './message'

export interface PersistedRoomSession {
  id: string
  roomIdInput: string
  autoConnect: boolean
}

export interface StreamerProfile {
  roomId: number
  shortId: number
  uid: number
  name: string
  avatar: string
  cover: string
  keyframe: string
  title: string
  areaName: string
  parentAreaName: string
  liveStatus: number
  fansCount: number
  guardCount: number
  onlineCount: number
}

export interface ContributorRankItem {
  rank: number
  username: string
  score: number
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
  autoConnect: boolean
  entryCount: number
  onlineCount: number
  wsLatency: number
  danmuWindowVisible: boolean
  streamer: StreamerProfile | null
  topContributors: ContributorRankItem[]
}
