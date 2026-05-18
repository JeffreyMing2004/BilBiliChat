import { LazyStore } from '@tauri-apps/plugin-store'

import type { DanmuConfig } from '../types/danmu'

const DEFAULT_CONFIG: DanmuConfig = {
  roomId: '',
  autoConnect: false,
  maxMessages: 300,
  reconnectInterval: 5,
}

const store = new LazyStore('settings.json', {
  autoSave: 100,
  defaults: {
    config: DEFAULT_CONFIG,
  },
})

export async function initializeConfigStore(): Promise<void> {
  await store.init()
}

export async function loadConfig(): Promise<DanmuConfig> {
  const config = await store.get<DanmuConfig>('config')

  return {
    ...DEFAULT_CONFIG,
    ...config,
  }
}

export async function saveConfig(config: DanmuConfig): Promise<void> {
  await store.set('config', config)
  await store.save()
}
