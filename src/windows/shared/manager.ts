import type { AppWindowLabel, OpenableWindowKind } from './types'
import { windowBridge } from '../../core/windows/WindowBridge'

export const WINDOW_LABELS: Record<AppWindowLabel, AppWindowLabel> = {
  main: 'main',
  danmu: 'danmu',
  settings: 'settings',
  login: 'login',
  debug: 'debug',
}

export function getCurrentWindowLabel(): AppWindowLabel {
  return windowBridge.getCurrentWindowLabel()
}

export async function openAppWindow(kind: OpenableWindowKind): Promise<void> {
  await windowBridge.openWindow(kind)
}

export async function closeCurrentWindow(): Promise<void> {
  await windowBridge.closeCurrentWindow()
}
