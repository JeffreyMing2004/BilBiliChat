import { reactive } from 'vue'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

import { loadStorageItem, saveStorageItem } from '../../settings'
import { crashReporter } from '../../core/crash/CrashReporter'
import type { UpdateChannel } from '../../types/settings'
import type { AppSettings } from '../../types/settings'

export interface UpdaterState {
  initialized: boolean
  checking: boolean
  dialogVisible: boolean
  downloading: boolean
  installing: boolean
  progress: number
  currentVersion: string
  availableVersion: string
  channel: UpdateChannel
  notes: string
  publishedAt: string
  lastCheckedAt: number
  lastError: string
  downloaded: boolean
  autoChecked: boolean
}

const UPDATER_DISMISSED_KEY = 'bilbilichat.updater.dismissed.v1'

export const updaterState = reactive<UpdaterState>({
  initialized: false,
  checking: false,
  dialogVisible: false,
  downloading: false,
  installing: false,
  progress: 0,
  currentVersion: '0.0.0',
  availableVersion: '',
  channel: 'stable',
  notes: '',
  publishedAt: '',
  lastCheckedAt: 0,
  lastError: '',
  downloaded: false,
  autoChecked: false,
})

let cachedUpdate: Update | null = null

function updaterDismissedVersion(): string {
  return loadStorageItem<string>(UPDATER_DISMISSED_KEY, '')
}

function persistDismissedVersion(version: string): void {
  saveStorageItem(UPDATER_DISMISSED_KEY, version)
}

function createChannelHeaders(channel: UpdateChannel): HeadersInit {
  return {
    'x-bilbilichat-update-channel': channel,
  }
}

function resetAvailableUpdate(): void {
  updaterState.availableVersion = ''
  updaterState.notes = ''
  updaterState.publishedAt = ''
  updaterState.downloaded = false
  updaterState.progress = 0
}

function applyUpdateMetadata(update: Update): void {
  updaterState.availableVersion = update.version
  updaterState.notes = update.body ?? ''
  updaterState.publishedAt = update.date ?? ''
  updaterState.downloaded = false
  updaterState.progress = 0
}

export function openUpdateDialog(): void {
  updaterState.dialogVisible = true
}

export function closeUpdateDialog(): void {
  updaterState.dialogVisible = false
}

export function dismissAvailableUpdate(): void {
  if (updaterState.availableVersion) {
    persistDismissedVersion(updaterState.availableVersion)
  }
  closeUpdateDialog()
}

export function getUpdateNotes(): string {
  return updaterState.notes.trim() || '当前版本未提供额外更新日志。'
}

function shouldPromptVersion(version: string): boolean {
  return version !== updaterDismissedVersion()
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
  resetAvailableUpdate()
  cachedUpdate = null
}

export async function checkForAppUpdates(
  channel = updaterState.channel,
  options: {
    openDialog?: boolean
    silentNoUpdate?: boolean
  } = {},
): Promise<boolean> {
  updaterState.checking = true
  updaterState.lastError = ''
  updaterState.lastCheckedAt = Date.now()
  updaterState.channel = channel

  try {
    cachedUpdate = await check({
      headers: createChannelHeaders(channel),
      timeout: 15_000,
    })
    if (!cachedUpdate) {
      resetAvailableUpdate()
      if (!options.silentNoUpdate) {
        closeUpdateDialog()
      }
      return false
    }

    applyUpdateMetadata(cachedUpdate)
    if (options.openDialog) {
      openUpdateDialog()
    }
    return true
  } catch (error) {
    updaterState.lastError = error instanceof Error ? error.message : '检查更新失败'
    crashReporter.captureError('runtime', 'updater.checkForAppUpdates', error, {
      fatal: false,
      metadata: {
        channel,
      },
    })
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
    closeUpdateDialog()
    await relaunch()
    return true
  } catch (error) {
    updaterState.lastError = error instanceof Error ? error.message : '安装更新失败'
    crashReporter.captureError('runtime', 'updater.downloadAndInstallUpdate', error, {
      fatal: false,
      metadata: {
        channel: updaterState.channel,
        version: updaterState.availableVersion,
      },
    })
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
    openUpdateDialog()
    return true
  } catch (error) {
    updaterState.lastError = error instanceof Error ? error.message : '后台下载更新失败'
    crashReporter.captureError('runtime', 'updater.downloadUpdatePackage', error, {
      fatal: false,
      metadata: {
        channel: updaterState.channel,
        version: updaterState.availableVersion,
      },
    })
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
    closeUpdateDialog()
    await relaunch()
    return true
  } catch (error) {
    updaterState.lastError = error instanceof Error ? error.message : '更新安装失败'
    crashReporter.captureError('runtime', 'updater.installDownloadedUpdate', error, {
      fatal: false,
      metadata: {
        channel: updaterState.channel,
        version: updaterState.availableVersion,
      },
    })
    return false
  } finally {
    updaterState.installing = false
  }
}

export async function maybeAutoCheckForUpdates(settings: Pick<AppSettings, 'autoCheckUpdates' | 'updaterEnabled' | 'updateChannel'>): Promise<boolean> {
  if (!updaterState.initialized || updaterState.autoChecked) {
    return false
  }

  updaterState.autoChecked = true

  if (!settings.updaterEnabled || !settings.autoCheckUpdates) {
    return false
  }

  const available = await checkForAppUpdates(settings.updateChannel, {
    openDialog: false,
    silentNoUpdate: true,
  })

  if (available && shouldPromptVersion(updaterState.availableVersion)) {
    openUpdateDialog()
  }

  return available
}
