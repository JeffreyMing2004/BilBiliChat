import { pluginManager } from '../core/plugins/PluginManager'
import { logInfo, logWarn } from '../core/logger/Logger'
import type { BilBiliChatPlugin } from './index'

const pluginModules = import.meta.glob('../../plugins/*.ts')
const loadedPluginIds = new Set<string>()

function resolvePlugin(candidate: unknown): BilBiliChatPlugin | null {
  if (!candidate || typeof candidate !== 'object') {
    return null
  }

  const plugin = candidate as BilBiliChatPlugin
  return typeof plugin.id === 'string' && typeof plugin.name === 'string' ? plugin : null
}

export async function loadBuiltinPlugins(): Promise<string[]> {
  const loadedIds: string[] = []

  for (const loader of Object.values(pluginModules)) {
    const module = await loader()
    const moduleRecord = module as Record<string, unknown> & { default?: unknown }
    const plugin = resolvePlugin(moduleRecord.default ?? Object.values(moduleRecord)[0])
    if (!plugin) {
      continue
    }

    if (pluginManager.has(plugin.id)) {
      logWarn('plugin', `插件 ${plugin.id} 已存在，跳过重复加载`)
      continue
    }

    await pluginManager.register(plugin)
    loadedIds.push(plugin.id)
    loadedPluginIds.add(plugin.id)
  }

  logInfo('plugin', `已加载内置插件 ${loadedIds.join(', ') || '0 个'}`)
  return loadedIds
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    loadedPluginIds.forEach((pluginId) => {
      void pluginManager.unregister(pluginId)
    })
    loadedPluginIds.clear()
  })
}
