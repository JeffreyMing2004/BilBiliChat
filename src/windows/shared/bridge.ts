import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

import type { ActiveRoomEvent, RoomMessageEvent, RoomPatchEvent, RoomSyncSnapshot } from './types'

export const WINDOW_EVENTS = {
  danmuReady: 'livedanmu://danmu-ready',
  roomsSnapshot: 'livedanmu://rooms-snapshot',
  roomPatch: 'livedanmu://room-patch',
  roomMessage: 'livedanmu://room-message',
  activeRoom: 'livedanmu://active-room',
} as const

async function broadcastWindowEvent<T>(event: string, payload: T): Promise<void> {
  await invoke('broadcast_window_event', { event, payload })
}

export async function emitDanmuReady(): Promise<void> {
  await broadcastWindowEvent(WINDOW_EVENTS.danmuReady, { ready: true })
}

export async function emitRoomsSnapshot(payload: RoomSyncSnapshot): Promise<void> {
  await broadcastWindowEvent(WINDOW_EVENTS.roomsSnapshot, payload)
}

export async function emitRoomPatch(payload: RoomPatchEvent): Promise<void> {
  await broadcastWindowEvent(WINDOW_EVENTS.roomPatch, payload)
}

export async function emitRoomMessage(payload: RoomMessageEvent): Promise<void> {
  await broadcastWindowEvent(WINDOW_EVENTS.roomMessage, payload)
}

export async function emitActiveRoom(payload: ActiveRoomEvent): Promise<void> {
  await broadcastWindowEvent(WINDOW_EVENTS.activeRoom, payload)
}

export async function listenDanmuReady(handler: () => void): Promise<() => void> {
  const unlisten = await listen(WINDOW_EVENTS.danmuReady, () => {
    handler()
  })

  return () => {
    unlisten()
  }
}

export async function listenRoomsSnapshot(handler: (payload: RoomSyncSnapshot) => void): Promise<() => void> {
  const unlisten = await listen<RoomSyncSnapshot>(WINDOW_EVENTS.roomsSnapshot, (event) => {
    handler(event.payload)
  })

  return () => {
    unlisten()
  }
}

export async function listenRoomPatch(handler: (payload: RoomPatchEvent) => void): Promise<() => void> {
  const unlisten = await listen<RoomPatchEvent>(WINDOW_EVENTS.roomPatch, (event) => {
    handler(event.payload)
  })

  return () => {
    unlisten()
  }
}

export async function listenRoomMessage(handler: (payload: RoomMessageEvent) => void): Promise<() => void> {
  const unlisten = await listen<RoomMessageEvent>(WINDOW_EVENTS.roomMessage, (event) => {
    handler(event.payload)
  })

  return () => {
    unlisten()
  }
}

export async function listenActiveRoom(handler: (payload: ActiveRoomEvent) => void): Promise<() => void> {
  const unlisten = await listen<ActiveRoomEvent>(WINDOW_EVENTS.activeRoom, (event) => {
    handler(event.payload)
  })

  return () => {
    unlisten()
  }
}
