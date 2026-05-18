import { reactive } from 'vue'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

import type { UpdateChannel } from '../../types/settings'

export interface UpdaterState {
  initialized: boolean
  checking: boolean
  downloading: boolean
  installing: boolean
  progress: number
  currentVersion: string
  availableVersion: string
  channel: UpdateChannel
  notes: string
  lastCheckedAt: number
  lastError: string
  downloaded: boolean
}

export const updaterState = reactive<UpdaterState>({
  initialized: false,
  checking: false,
  downloading: false,
  installing: false,
  progress: 0,
  currentVersion: '0.0.0',
  availableVersion: '',
  channel: 'stable',
  notes: '',
  lastCheckedAt: 0,
  lastError: '',
  downloaded: false,
})

let cachedUpdate: Update | null = null

function resolveTarget(channel: UpdateChannel): string | undefined {
  if (channel === 'stable') {
    return undefined
  }

  return channel
}

export async function initializeUpdater(currentVersion: string): Promise<void> {
  updaterState.currentVersion = currentVersion
  updaterState.initialized = true
}

export function setUpdateChannel(channel: UpdateChannel): void {
  if (updaterState.channel === channel) {
    return
  }

  updaterState.channel = channel
  updaterState.availableVersion = ''
  updaterState.notes = ''
  updaterState.downloaded = false
  cachedUpdate = null
}

export async function checkForAppUpdates(channel = updaterState.channel): Promise<boolean> {
  updaterState.checking = true
  updaterState.lastError = ''
  updaterState.lastCheckedAt = Date.now()
  updaterState.channel = channel

  try {
    cachedUpdate = await check({
      target: resolveTarget(channel),
      timeout: 15_000,
    })
    if (!cachedUpdate) {
      updaterState.availableVersion = ''
      updaterState.notes = ''
      updaterState.downloaded = false
      return false
    }

    updaterState.availableVersion = cachedUpdate.version
    updaterState.notes = cachedUpdate.body ?? ''
    updaterState.downloaded = false
    updaterState.progress = 0
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

  updaterState.downloading = true
  updaterState.installing = true
  updaterState.progress = 0
  updaterState.lastError = ''

  try {
    await cachedUpdate.downloadAndInstall((event) => {
      if (event.event === 'Progress') {
        updaterState.progress = Math.min(99, updaterState.progress + Math.max(1, Math.round(event.data.chunkLength / 50_000)))
      }
    })
    updaterState.progress = 100
    updaterState.downloaded = true
    await relaunch()
    return true
  } catch (error) {
    updaterState.lastError = error instanceof Error ? error.message : '安装更新失败'
    return false
  } finally {
    updaterState.downloading = false
    updaterState.installing = false
  }
}

export async function downloadUpdatePackage(): Promise<boolean> {
  if (!cachedUpdate) {
    return false
  }

  updaterState.downloading = true
  updaterState.progress = 0
  updaterState.lastError = ''

  try {
    await cachedUpdate.download((event) => {
      if (event.event === 'Progress') {
        updaterState.progress = Math.min(99, updaterState.progress + Math.max(1, Math.round(event.data.chunkLength / 50_000)))
      }
      if (event.event === 'Finished') {
        updaterState.progress = 100
      }
    }, {
      timeout: 60_000,
    })
    updaterState.downloaded = true
    return true
  } catch (error) {
    updaterState.lastError = error instanceof Error ? error.message : '后台下载更新失败'
    return false
  } finally {
    updaterState.downloading = false
  }
}

export async function installDownloadedUpdate(): Promise<boolean> {
  if (!cachedUpdate || !updaterState.downloaded) {
    return false
  }

  updaterState.installing = true
  updaterState.lastError = ''
  try {
    await cachedUpdate.install()
    await relaunch()
    return true
  } catch (error) {
    updaterState.lastError = error instanceof Error ? error.message : '更新安装失败'
    return false
  } finally {
    updaterState.installing = false
  }
}
