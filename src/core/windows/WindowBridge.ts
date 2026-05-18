import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'

import { logDebug } from '../logger/Logger'
import type { ActiveRoomEvent, AppWindowLabel, OpenableWindowKind, RoomMessageEvent, RoomPatchEvent, RoomSyncSnapshot } from '../../windows/shared/types'

export const WINDOW_EVENTS = {
  danmuReady: 'livedanmu://danmu-ready',
  roomsSnapshot: 'livedanmu://rooms-snapshot',
  roomPatch: 'livedanmu://room-patch',
  roomMessage: 'livedanmu://room-message',
  activeRoom: 'livedanmu://active-room',
} as const

export class WindowBridge {
  getCurrentWindowLabel(): AppWindowLabel {
    const label = getCurrentWindow().label
    if (
      label === 'danmu'
      || label === 'settings'
      || label === 'login'
      || label === 'debug'
      || label === 'overlay-studio'
      || label === 'crash'
    ) {
      return label
    }
    return 'main'
  }

  async openWindow(kind: OpenableWindowKind): Promise<void> {
    await invoke('open_app_window', { kind })
  }

  async closeCurrentWindow(): Promise<void> {
    await invoke('close_app_window', { label: this.getCurrentWindowLabel() })
  }

  async broadcast<T>(event: string, payload: T): Promise<void> {
    logDebug('windows', `broadcast ${event}`)
    await invoke('broadcast_window_event', { event, payload })
  }

  async emitDanmuReady(): Promise<void> {
    await this.broadcast(WINDOW_EVENTS.danmuReady, { ready: true })
  }

  async emitRoomsSnapshot(payload: RoomSyncSnapshot): Promise<void> {
    await this.broadcast(WINDOW_EVENTS.roomsSnapshot, payload)
  }

  async emitRoomPatch(payload: RoomPatchEvent): Promise<void> {
    await this.broadcast(WINDOW_EVENTS.roomPatch, payload)
  }

  async emitRoomMessage(payload: RoomMessageEvent): Promise<void> {
    await this.broadcast(WINDOW_EVENTS.roomMessage, payload)
  }

  async emitActiveRoom(payload: ActiveRoomEvent): Promise<void> {
    await this.broadcast(WINDOW_EVENTS.activeRoom, payload)
  }

  async listenDanmuReady(handler: () => void): Promise<() => void> {
    const unlisten = await listen(WINDOW_EVENTS.danmuReady, () => handler())
    return () => unlisten()
  }

  async listenRoomsSnapshot(handler: (payload: RoomSyncSnapshot) => void): Promise<() => void> {
    const unlisten = await listen<RoomSyncSnapshot>(WINDOW_EVENTS.roomsSnapshot, (event) => handler(event.payload))
    return () => unlisten()
  }

  async listenRoomPatch(handler: (payload: RoomPatchEvent) => void): Promise<() => void> {
    const unlisten = await listen<RoomPatchEvent>(WINDOW_EVENTS.roomPatch, (event) => handler(event.payload))
    return () => unlisten()
  }

  async listenRoomMessage(handler: (payload: RoomMessageEvent) => void): Promise<() => void> {
    const unlisten = await listen<RoomMessageEvent>(WINDOW_EVENTS.roomMessage, (event) => handler(event.payload))
    return () => unlisten()
  }

  async listenActiveRoom(handler: (payload: ActiveRoomEvent) => void): Promise<() => void> {
    const unlisten = await listen<ActiveRoomEvent>(WINDOW_EVENTS.activeRoom, (event) => handler(event.payload))
    return () => unlisten()
  }
}

export const windowBridge = new WindowBridge()
