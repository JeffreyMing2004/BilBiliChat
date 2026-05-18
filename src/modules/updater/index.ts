import { reactive } from 'vue'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export interface UpdaterState {
  initialized: boolean
  checking: boolean
  installing: boolean
  progress: number
  currentVersion: string
  availableVersion: string
  notes: string
  lastCheckedAt: number
  lastError: string
}

export const updaterState = reactive<UpdaterState>({
  initialized: false,
  checking: false,
  installing: false,
  progress: 0,
  currentVersion: '0.0.0',
  availableVersion: '',
  notes: '',
  lastCheckedAt: 0,
  lastError: '',
})

let cachedUpdate: Update | null = null

export async function initializeUpdater(currentVersion: string): Promise<void> {
  updaterState.currentVersion = currentVersion
  updaterState.initialized = true
}

export async function checkForAppUpdates(): Promise<boolean> {
  updaterState.checking = true
  updaterState.lastError = ''
  updaterState.lastCheckedAt = Date.now()

  try {
    cachedUpdate = await check()
    if (!cachedUpdate) {
      updaterState.availableVersion = ''
      updaterState.notes = ''
      return false
    }

    updaterState.availableVersion = cachedUpdate.version
    updaterState.notes = cachedUpdate.body ?? ''
    return true
  } catch (error) {
    updaterState.lastError = error instanceof Error ? error.message : '检查更新失败'
    return false
  } finally {
    updaterState.checking = false
  }
}

export async function downloadAndInstallUpdate(): Promise<boolean> {
  if (!cachedUpdate) {
    return false
  }

  updaterState.installing = true
  updaterState.progress = 0
  updaterState.lastError = ''

  try {
    await cachedUpdate.downloadAndInstall((event) => {
      if ('progress' in event && typeof event.progress === 'number') {
        updaterState.progress = Math.round(event.progress * 100)
      }
    })
    await relaunch()
    return true
  } catch (error) {
    updaterState.lastError = error instanceof Error ? error.message : '安装更新失败'
    return false
  } finally {
    updaterState.installing = false
  }
}
