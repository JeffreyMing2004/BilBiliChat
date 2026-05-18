import type { LiveMessage } from '../../types/message'
import type { RoomSessionState } from '../../types/room'

export type AppWindowLabel = 'main' | 'danmu' | 'settings' | 'login'
export type OpenableWindowKind = Exclude<AppWindowLabel, 'main'>

export interface RoomSyncSnapshot {
  roomOrder: string[]
  activeRoomId: string
  rooms: Record<string, RoomSessionState>
}

export interface RoomPatchEvent {
  roomId: string
  patch: Partial<RoomSessionState>
}

export interface RoomMessageEvent {
  roomId: string
  message: LiveMessage
  maxMessages: number
}

export interface ActiveRoomEvent {
  roomId: string
}
