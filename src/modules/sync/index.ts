import type { AppSettings } from '../../types/settings'

export interface ProductConfigSnapshot {
  version: 1
  exportedAt: number
  settings: AppSettings
  plugins: {
    enabledIds: string[]
  }
}

export function exportProductConfig(settings: AppSettings, enabledPluginIds: string[] = []): string {
  const snapshot: ProductConfigSnapshot = {
    version: 1,
    exportedAt: Date.now(),
    settings,
    plugins: {
      enabledIds: enabledPluginIds,
    },
  }

  return JSON.stringify(snapshot, null, 2)
}

export function importProductConfig(input: string): ProductConfigSnapshot {
  const payload = JSON.parse(input) as ProductConfigSnapshot
  if (payload.version !== 1 || !payload.settings) {
    throw new Error('配置版本不兼容，无法导入')
  }

  return {
    version: 1,
    exportedAt: Number(payload.exportedAt ?? Date.now()),
    settings: payload.settings,
    plugins: {
      enabledIds: Array.isArray(payload.plugins?.enabledIds)
        ? payload.plugins.enabledIds.map((item) => String(item))
        : [],
    },
  }
}
