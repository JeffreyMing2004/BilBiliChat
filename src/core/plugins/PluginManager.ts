import { eventBus } from '../events/EventBus'
import { logError, logInfo, logWarn } from '../logger/Logger'
import type {
  ConnectEventPayload,
  DisconnectEventPayload,
  MessageEventPayload,
  RoomSwitchEventPayload,
} from '../../types/events'

export type PluginHookName = 'onMessage' | 'onConnect' | 'onDisconnect' | 'onRoomSwitch'

export interface PluginHookPayloadMap {
  onMessage: MessageEventPayload
  onConnect: ConnectEventPayload
  onDisconnect: DisconnectEventPayload
  onRoomSwitch: RoomSwitchEventPayload
}

export interface PluginContext {
  onEvent: typeof eventBus.on
  emitEvent: typeof eventBus.emit
}

export interface AppPlugin {
  id: string
  name: string
  version: string
  enabled?: boolean
  onRegister?: (context: PluginContext) => void | Promise<void>
  onEnable?: (context: PluginContext) => void | Promise<void>
  onDisable?: (context: PluginContext) => void | Promise<void>
  onUnload?: (context: PluginContext) => void | Promise<void>
  hooks?: Partial<{
    [K in PluginHookName]: (payload: PluginHookPayloadMap[K], context: PluginContext) => void | Promise<void>
  }>
}

interface PluginRuntimeState {
  plugin: AppPlugin
  enabled: boolean
  cleanups: Array<() => void>
}

type PluginStateListener = (plugins: Array<{ id: string; name: string; enabled: boolean; version: string }>) => void

export class PluginManager {
  private readonly plugins = new Map<string, PluginRuntimeState>()
  private readonly listeners = new Set<PluginStateListener>()

  subscribe(listener: PluginStateListener): () => void {
    this.listeners.add(listener)
    listener(this.getState())

    return () => {
      this.listeners.delete(listener)
    }
  }

  getState(): Array<{ id: string; name: string; enabled: boolean; version: string }> {
    return Array.from(this.plugins.values()).map(({ plugin, enabled }) => ({
      id: plugin.id,
      name: plugin.name,
      enabled,
      version: plugin.version,
    }))
  }

  has(pluginId: string): boolean {
    return this.plugins.has(pluginId)
  }

  async register(plugin: AppPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`插件 ${plugin.id} 已存在`)
    }

    const runtime: PluginRuntimeState = {
      plugin,
      enabled: false,
      cleanups: [],
    }
    this.plugins.set(plugin.id, runtime)
    await plugin.onRegister?.(this.createContext(runtime))
    logInfo('plugin', `已注册插件 ${plugin.id}`)

    if (plugin.enabled !== false) {
      await this.enable(plugin.id)
    } else {
      this.notify()
    }
  }

  async enable(pluginId: string): Promise<void> {
    const runtime = this.plugins.get(pluginId)
    if (!runtime || runtime.enabled) {
      return
    }

    runtime.enabled = true
    await runtime.plugin.onEnable?.(this.createContext(runtime))
    logInfo('plugin', `已启用插件 ${pluginId}`)
    this.notify()
  }

  async disable(pluginId: string): Promise<void> {
    const runtime = this.plugins.get(pluginId)
    if (!runtime || !runtime.enabled) {
      return
    }

    runtime.enabled = false
    runtime.cleanups.forEach((cleanup) => cleanup())
    runtime.cleanups.length = 0
    await runtime.plugin.onDisable?.(this.createContext(runtime))
    logWarn('plugin', `已停用插件 ${pluginId}`)
    this.notify()
  }

  async unregister(pluginId: string): Promise<void> {
    const runtime = this.plugins.get(pluginId)
    if (!runtime) {
      return
    }

    await this.disable(pluginId)
    await runtime.plugin.onUnload?.(this.createContext(runtime))
    this.plugins.delete(pluginId)
    logInfo('plugin', `已卸载插件 ${pluginId}`)
    this.notify()
  }

  async emitHook<K extends PluginHookName>(hookName: K, payload: PluginHookPayloadMap[K]): Promise<void> {
    for (const runtime of this.plugins.values()) {
      if (!runtime.enabled) {
        continue
      }

      const hook = runtime.plugin.hooks?.[hookName]
      if (!hook) {
        continue
      }

      try {
        await hook(payload, this.createContext(runtime))
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误'
        logError('plugin', `插件 ${runtime.plugin.id} 执行 ${hookName} 失败：${message}`)
      }
    }
  }

  private notify(): void {
    const state = this.getState()
    this.listeners.forEach((listener) => listener(state))
  }

  private createContext(runtime: PluginRuntimeState): PluginContext {
    return {
      onEvent: ((event, handler) => {
        const cleanup = eventBus.on(event, handler as never)
        runtime.cleanups.push(cleanup)
        return cleanup
      }) as typeof eventBus.on,
      emitEvent: eventBus.emit.bind(eventBus),
    }
  }

  async destroy(): Promise<void> {
    const ids = Array.from(this.plugins.keys())
    for (const pluginId of ids) {
      await this.unregister(pluginId)
    }
    this.listeners.clear()
  }
}

export const pluginManager = new PluginManager()
