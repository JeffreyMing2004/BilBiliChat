import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

import type { AppWindowLabel, OpenableWindowKind } from './types'

export const WINDOW_LABELS: Record<AppWindowLabel, AppWindowLabel> = {
  main: 'main',
  danmu: 'danmu',
  settings: 'settings',
  login: 'login',
}

export function getCurrentWindowLabel(): AppWindowLabel {
  const label = getCurrentWindow().label

  if (label === WINDOW_LABELS.danmu || label === WINDOW_LABELS.settings || label === WINDOW_LABELS.login) {
    return label
  }

  return WINDOW_LABELS.main
}

export async function openAppWindow(kind: OpenableWindowKind): Promise<void> {
  await invoke('open_app_window', { kind })
}

export async function closeCurrentWindow(): Promise<void> {
  await getCurrentWindow().close()
}
