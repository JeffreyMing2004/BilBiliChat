import { listen } from '@tauri-apps/api/event'
import { PhysicalPosition, PhysicalSize, getCurrentWindow } from '@tauri-apps/api/window'

import { recoveryManager } from '../core/recovery/RecoveryManager'
import { loadStorageItem, saveStorageItem, windowStateStorageKey } from '../settings'
import type { AppSettings, WindowStateSnapshot } from '../types/settings'
import { getCurrentWindowLabel } from '../windows/shared/manager'

const DEFAULT_WINDOW_STATE: WindowStateSnapshot = {
  width: 1440,
  height: 900,
  x: 180,
  y: 120,
}

export async function restoreWindowState(): Promise<void> {
  const currentWindow = getCurrentWindow()
  const state = loadStorageItem(windowStateStorageKey(currentWindow.label), DEFAULT_WINDOW_STATE)

  await currentWindow.setSize(new PhysicalSize(state.width, state.height))
  await currentWindow.setPosition(new PhysicalPosition(state.x, state.y))
}

export async function initializeWindowState(): Promise<() => void> {
  const currentWindow = getCurrentWindow()
  const windowLabel = getCurrentWindowLabel()
  await restoreWindowState()
  recoveryManager.captureWindow(windowLabel, true)

  const saveBounds = async () => {
    const [size, position] = await Promise.all([currentWindow.outerSize(), currentWindow.outerPosition()])
    saveStorageItem(windowStateStorageKey(currentWindow.label), {
      width: size.width,
      height: size.height,
      x: position.x,
      y: position.y,
    })
  }

  const unlistenResize = await currentWindow.onResized(() => {
    void saveBounds()
  })
  const unlistenMove = await currentWindow.onMoved(() => {
    void saveBounds()
  })
  const unlistenClose = await currentWindow.onCloseRequested(async (event) => {
    const settingsStore = (await import('../stores/settings')).useSettingsStore()

    if (windowLabel === 'main' && settingsStore.settings.minimizeToTray) {
      event.preventDefault()
      recoveryManager.captureWindow(windowLabel, false)
      await currentWindow.hide()
    }
  })
  const unlistenShow = await listen('tray://show-window', async () => {
    recoveryManager.captureWindow(windowLabel, true)
    await showMainWindow()
  })

  return () => {
    recoveryManager.captureWindow(windowLabel, false)
    unlistenResize()
    unlistenMove()
    unlistenClose()
    unlistenShow()
  }
}

export async function applyWindowPreferences(settings: AppSettings): Promise<void> {
  const currentWindow = getCurrentWindow()
  const windowLabel = getCurrentWindowLabel()

  if (windowLabel === 'danmu') {
    await currentWindow.setDecorations(false)
    await currentWindow.setAlwaysOnTop(true)
    await currentWindow.setSkipTaskbar(true)
    await currentWindow.setIgnoreCursorEvents(settings.obsMode && settings.clickThrough)
    return
  }

  await currentWindow.setDecorations(false)
  await currentWindow.setAlwaysOnTop(settings.alwaysOnTop)
  await currentWindow.setSkipTaskbar(false)
  await currentWindow.setIgnoreCursorEvents(false)
}

export async function showMainWindow(): Promise<void> {
  const currentWindow = getCurrentWindow()

  await currentWindow.show()
  await currentWindow.unminimize()
  await currentWindow.setFocus()
}
