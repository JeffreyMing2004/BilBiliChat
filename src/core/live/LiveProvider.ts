import type { LiveMessage } from '../../types/message'
import type { LiveProviderKind } from '../../types/live'
import type { OpenLiveDebugRecord, OpenLiveStateSnapshot } from '../../types/openlive'
import type { RawDanmuCommand, ReconnectNotice } from '../../types/websocket'

export interface LiveProviderStatusPayload {
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'
  statusText: string
  websocketState: string
  reconnectCount: number
  providerKind?: LiveProviderKind
  openLive?: OpenLiveStateSnapshot | null
  error?: string
}

export interface LiveProviderRoomInfo {
  kind: LiveProviderKind
  roomId: number
  displayName: string
  connected: boolean
}

export interface LiveProviderOptions {
  roomKey: string
  roomId: number
  reconnectInterval: number
  autoReconnect: boolean
  openLiveIdentityCode?: string
  onStatus: (payload: LiveProviderStatusPayload) => void
  onPopularity: (popularity: number) => void
  onLatency?: (latency: number) => void
  onMessage: (message: LiveMessage) => void
  onRawCommand?: (payload: RawDanmuCommand) => void
  onOpenLiveState?: (payload: OpenLiveStateSnapshot | null) => void
  onOpenLiveDebug?: (record: OpenLiveDebugRecord) => void
  onReconnectScheduled?: (notice: ReconnectNotice) => void
}

export interface LiveProvider {
  readonly kind: LiveProviderKind
  connect(): Promise<void>
  disconnect(): Promise<void>
  sendHeartbeat(): void
  getRoomInfo(): Promise<LiveProviderRoomInfo>
}
