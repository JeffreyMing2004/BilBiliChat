import type { AppPlugin, PluginContext, PluginHookName, PluginHookPayloadMap } from '../core/plugins/PluginManager'

export interface BilBiliChatPluginApi {
  on<K extends PluginHookName>(hookName: K, handler: (payload: PluginHookPayloadMap[K], context: PluginContext) => void | Promise<void>): Pick<AppPlugin, 'hooks'>
  onEvent: PluginContext['onEvent']
  emitEvent: PluginContext['emitEvent']
}

export type BilBiliChatPlugin = AppPlugin

export function defineBilBiliChatPlugin(plugin: BilBiliChatPlugin): BilBiliChatPlugin {
  return plugin
}

export function createPluginHook<K extends PluginHookName>(
  hookName: K,
  handler: (payload: PluginHookPayloadMap[K], context: PluginContext) => void | Promise<void>,
): Pick<AppPlugin, 'hooks'> {
  return {
    hooks: {
      [hookName]: handler,
    },
  }
}
