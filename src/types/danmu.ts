export type {
  AuthReplyPayload,
  ConnectionStatus,
  DanmuMessageItem,
  RawDanmuCommand,
  ReconnectNotice,
  RoomConnectionState as StatusSnapshot,
} from './websocket'

export interface DanmuConfig {
  roomId: string
  reconnectInterval: number
  maxMessages: number
}
