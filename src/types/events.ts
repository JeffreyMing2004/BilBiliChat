import type { LiveMessage } from './message'
import type { ConnectionStatusPayload, ReconnectNotice } from './websocket'

export const APP_EVENT = {
  MESSAGE: 'MESSAGE',
  CONNECT: 'CONNECT',
  DISCONNECT: 'DISCONNECT',
  RECONNECT: 'RECONNECT',
  ROOM_SWITCH: 'ROOM_SWITCH',
  POPULARITY_UPDATE: 'POPULARITY_UPDATE',
} as const

export type AppEventName = keyof typeof APP_EVENT

export interface MessageEventPayload {
  roomKey: string
  message: LiveMessage
}

export interface ConnectEventPayload {
  roomKey: string
  connection: ConnectionStatusPayload
}

export interface DisconnectEventPayload {
  roomKey: string
  connection: ConnectionStatusPayload
}

export interface ReconnectEventPayload {
  roomKey: string
  notice: ReconnectNotice
}

export interface RoomSwitchEventPayload {
  roomKey: string
}

export interface PopularityUpdateEventPayload {
  roomKey: string
  popularity: number
  latency: number
}

export interface AppEventMap {
  MESSAGE: MessageEventPayload
  CONNECT: ConnectEventPayload
  DISCONNECT: DisconnectEventPayload
  RECONNECT: ReconnectEventPayload
  ROOM_SWITCH: RoomSwitchEventPayload
  POPULARITY_UPDATE: PopularityUpdateEventPayload
}
