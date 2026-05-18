import { listen } from '@tauri-apps/api/event'
import { PhysicalPosition, PhysicalSize, getCurrentWindow } from '@tauri-apps/api/window'

import { loadStorageItem, saveStorageItem, windowStateStorageKey } from '../settings'
import type { AppSettings, WindowStateSnapshot } from '../types/settings'

const DEFAULT_WINDOW_STATE: WindowStateSnapshot = {
  width: 1440,
  height: 900,
  x: 180,
  y: 120,
}

export async function restoreWindowState(): Promise<void> {
  const currentWindow = getCurrentWindow()
  const state = loadStorageItem(windowStateStorageKey(), DEFAULT_WINDOW_STATE)

  await currentWindow.setSize(new PhysicalSize(state.width, state.height))
  await currentWindow.setPosition(new PhysicalPosition(state.x, state.y))
}

export async function initializeWindowState(): Promise<() => void> {
  const currentWindow = getCurrentWindow()
  await restoreWindowState()

  const saveBounds = async () => {
    const [size, position] = await Promise.all([currentWindow.outerSize(), currentWindow.outerPosition()])
    saveStorageItem(windowStateStorageKey(), {
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

    if (settingsStore.settings.minimizeToTray) {
      event.preventDefault()
      await currentWindow.hide()
    }
  })
  const unlistenShow = await listen('tray://show-window', async () => {
    await showMainWindow()
  })

  return () => {
    unlistenResize()
    unlistenMove()
    unlistenClose()
    unlistenShow()
  }
}

export async function applyWindowPreferences(settings: AppSettings): Promise<void> {
  const currentWindow = getCurrentWindow()
  const enableOverlayWindow = settings.obsMode

  await currentWindow.setDecorations(!enableOverlayWindow)
  await currentWindow.setAlwaysOnTop(enableOverlayWindow || settings.alwaysOnTop)
  await currentWindow.setSkipTaskbar(enableOverlayWindow)
  await currentWindow.setIgnoreCursorEvents(enableOverlayWindow && settings.clickThrough)
}

export async function showMainWindow(): Promise<void> {
  const currentWindow = getCurrentWindow()

  await currentWindow.show()
  await currentWindow.unminimize()
  await currentWindow.setFocus()
}
