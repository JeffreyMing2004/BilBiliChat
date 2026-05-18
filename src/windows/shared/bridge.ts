import { windowBridge } from '../../core/windows/WindowBridge'
import type { ActiveRoomEvent, RoomMessageEvent, RoomPatchEvent, RoomSyncSnapshot } from './types'

export async function emitDanmuReady(): Promise<void> {
  await windowBridge.emitDanmuReady()
}

export async function emitRoomsSnapshot(payload: RoomSyncSnapshot): Promise<void> {
  await windowBridge.emitRoomsSnapshot(payload)
}

export async function emitRoomPatch(payload: RoomPatchEvent): Promise<void> {
  await windowBridge.emitRoomPatch(payload)
}

export async function emitRoomMessage(payload: RoomMessageEvent): Promise<void> {
  await windowBridge.emitRoomMessage(payload)
}

export async function emitActiveRoom(payload: ActiveRoomEvent): Promise<void> {
  await windowBridge.emitActiveRoom(payload)
}

export async function listenDanmuReady(handler: () => void): Promise<() => void> {
  return windowBridge.listenDanmuReady(handler)
}

export async function listenRoomsSnapshot(handler: (payload: RoomSyncSnapshot) => void): Promise<() => void> {
  return windowBridge.listenRoomsSnapshot(handler)
}

export async function listenRoomPatch(handler: (payload: RoomPatchEvent) => void): Promise<() => void> {
  return windowBridge.listenRoomPatch(handler)
}

export async function listenRoomMessage(handler: (payload: RoomMessageEvent) => void): Promise<() => void> {
  return windowBridge.listenRoomMessage(handler)
}

export async function listenActiveRoom(handler: (payload: ActiveRoomEvent) => void): Promise<() => void> {
  return windowBridge.listenActiveRoom(handler)
}
