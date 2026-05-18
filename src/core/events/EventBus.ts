import { logDebug } from '../logger/Logger'
import type { AppEventMap, AppEventName } from '../../types/events'

type EventHandler<K extends AppEventName> = (payload: AppEventMap[K]) => void

class EventBus {
  private readonly listeners = new Map<AppEventName, Set<(payload: unknown) => void>>()

  emit<K extends AppEventName>(event: K, payload: AppEventMap[K]): void {
    logDebug('eventbus', `emit ${event}`)
    const handlers = this.listeners.get(event)
    if (!handlers) {
      return
    }

    handlers.forEach((handler) => {
      handler(payload)
    })
  }

  on<K extends AppEventName>(event: K, handler: EventHandler<K>): () => void {
    const handlers = this.listeners.get(event) ?? new Set<(payload: unknown) => void>()
    handlers.add(handler as (payload: unknown) => void)
    this.listeners.set(event, handlers)

    return () => {
      handlers.delete(handler as (payload: unknown) => void)
      if (handlers.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}

export const eventBus = new EventBus()
