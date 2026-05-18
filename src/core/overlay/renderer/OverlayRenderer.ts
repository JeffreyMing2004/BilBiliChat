import type { LiveMessage } from '../../../types/message'
import type { AppSettings } from '../../../types/settings'
import { resolveOpenLiveMessageTags, resolveOpenLiveMessageVariant } from '../../../modules/openlive'
import { reportOverlayCrash } from '../../crash/CrashReporter'
import type { PerformanceMonitor } from '../../performance/PerformanceMonitor'
import { logInfo } from '../../logger/Logger'
import { recoveryManager } from '../../recovery/RecoveryManager'

interface OverlayRendererOptions {
  container: HTMLElement
  settings: AppSettings
  performanceMonitor?: PerformanceMonitor
  maxVisibleItems?: number
  maxQueueSize?: number
  messageTtlMs?: number
  batchSize?: number
}

interface OverlayNodeRefs {
  header: HTMLDivElement
  name: HTMLSpanElement
  badge: HTMLSpanElement
  meta: HTMLDivElement
  content: HTMLDivElement
}

interface RenderRecord {
  id: string
  element: HTMLDivElement
  mountedAt: number
  expiresAt: number
}

interface RecycleRecord {
  element: HTMLDivElement
  releaseAt: number
}

class MessagePool {
  private readonly pool: HTMLDivElement[] = []
  private readonly refs = new WeakMap<HTMLDivElement, OverlayNodeRefs>()

  acquire(): HTMLDivElement {
    const element = this.pool.pop() ?? this.createElement()
    element.className = 'overlay-render-item'
    element.style.removeProperty('opacity')
    element.style.removeProperty('transform')
    return element
  }

  release(element: HTMLDivElement): void {
    const refs = this.refs.get(element)
    if (refs) {
      refs.name.textContent = ''
      refs.badge.textContent = ''
      refs.meta.textContent = ''
      refs.meta.hidden = false
      refs.content.textContent = ''
    }
    element.className = 'overlay-render-item'
    delete element.dataset.provider
    delete element.dataset.command
    element.style.removeProperty('--overlay-message-accent')
    element.remove()
    this.pool.push(element)
  }

  getRefs(element: HTMLDivElement): OverlayNodeRefs {
    const refs = this.refs.get(element)
    if (!refs) {
      throw new Error('OverlayRenderer 节点引用丢失')
    }

    return refs
  }

  private createElement(): HTMLDivElement {
    const element = document.createElement('div')
    const header = document.createElement('div')
    const name = document.createElement('span')
    const badge = document.createElement('span')
    const meta = document.createElement('div')
    const content = document.createElement('div')

    header.className = 'overlay-render-item__header'
    name.className = 'overlay-render-item__name'
    badge.className = 'overlay-render-item__badge'
    meta.className = 'overlay-render-item__meta'
    content.className = 'overlay-render-item__content'

    header.append(name, badge)
    element.append(header, meta, content)

    this.refs.set(element, {
      header,
      name,
      badge,
      meta,
      content,
    })

    return element
  }
}

export class OverlayRenderer {
  private readonly container: HTMLElement
  private readonly performanceMonitor?: PerformanceMonitor
  private readonly pool = new MessagePool()
  private settings: AppSettings
  private queue: LiveMessage[] = []
  private activeRecords: RenderRecord[] = []
  private recycleQueue: RecycleRecord[] = []
  private rafId: number | null = null
  private destroyed = false
  private droppedMessages = 0
  private readonly maxVisibleItems: number
  private readonly maxQueueSize: number
  private readonly messageTtlMs: number
  private readonly batchSize: number

  constructor(options: OverlayRendererOptions) {
    this.container = options.container
    this.settings = options.settings
    this.performanceMonitor = options.performanceMonitor
    this.maxVisibleItems = options.maxVisibleItems ?? 48
    this.maxQueueSize = options.maxQueueSize ?? 120
    this.messageTtlMs = options.messageTtlMs ?? 22_000
    this.batchSize = options.batchSize ?? 4
    this.applySettings()
    this.start()
  }

  enqueue(message: LiveMessage): void {
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift()
      this.droppedMessages += 1
    }

    this.queue.push(message)
    this.performanceMonitor?.updateQueue(this.queue.length, this.droppedMessages)
  }

  replaceMessages(messages: LiveMessage[]): void {
    this.clear()
    const snapshot = messages.slice(-this.maxVisibleItems)
    snapshot.forEach((message) => this.queue.push(message))
    this.performanceMonitor?.updateQueue(this.queue.length, this.droppedMessages)
  }

  updateSettings(settings: AppSettings): void {
    this.settings = settings
    this.applySettings()
  }

  clear(): void {
    this.queue = []
    this.recycleQueue.forEach((record) => {
      this.pool.release(record.element)
    })
    this.recycleQueue = []
    this.activeRecords.forEach((record) => {
      this.pool.release(record.element)
    })
    this.activeRecords = []
    this.container.textContent = ''
    this.performanceMonitor?.updateDomCount(0)
    this.performanceMonitor?.updateQueue(0, this.droppedMessages)
  }

  destroy(): void {
    this.destroyed = true
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.clear()
    logInfo('overlay', 'OverlayRenderer 已销毁')
  }

  private start(): void {
    if (this.rafId !== null) {
      return
    }

    this.loop()
    logInfo('overlay', 'OverlayRenderer 已启动')
  }

  private loop = (): void => {
    if (this.destroyed) {
      return
    }

    try {
      const startedAt = performance.now()
      const now = Date.now()
      recoveryManager.markOverlayHeartbeat()
      this.releaseExpiredNodes(now)
      this.processIncomingQueue(now)
      this.trimVisibleNodes()
      const renderDuration = performance.now() - startedAt
      this.performanceMonitor?.recordFrame(renderDuration)
      this.performanceMonitor?.updateDomCount(this.activeRecords.length)
      this.performanceMonitor?.updateQueue(this.queue.length, this.droppedMessages)
    } catch (error) {
      reportOverlayCrash('OverlayRenderer.loop', error, {
        activeRecords: this.activeRecords.length,
        droppedMessages: this.droppedMessages,
        queuedMessages: this.queue.length,
      })
      this.clear()
    }

    this.rafId = requestAnimationFrame(this.loop)
  }

  private releaseExpiredNodes(now: number): void {
    this.recycleQueue = this.recycleQueue.filter((record) => {
      if (record.releaseAt > now) {
        return true
      }

      this.pool.release(record.element)
      return false
    })

    for (const record of [...this.activeRecords]) {
      if (record.expiresAt <= now) {
        this.markForRecycle(record)
      }
    }
  }

  private processIncomingQueue(now: number): void {
    if (this.queue.length === 0) {
      return
    }

    const fragment = document.createDocumentFragment()
    const count = Math.min(this.batchSize, this.queue.length)
    const batch: LiveMessage[] = []
    for (let index = 0; index < count; index += 1) {
      const message = this.queue.shift()
      if (!message) {
        break
      }

      batch.push(message)
    }

    const renderBatch = this.settings.direction === 'top-down'
      ? [...batch].reverse()
      : batch
    const createdRecords: RenderRecord[] = []

    renderBatch.forEach((message) => {
      const element = this.pool.acquire()
      this.renderMessage(element, message)
      fragment.appendChild(element)
      createdRecords.push({
        id: message.id,
        element,
        mountedAt: now,
        expiresAt: now + this.messageTtlMs,
      })
    })

    this.activeRecords.push(
      ...(this.settings.direction === 'top-down'
        ? createdRecords.reverse()
        : createdRecords),
    )

    if (this.settings.direction === 'top-down') {
      this.container.prepend(fragment)
      this.container.dataset.direction = 'top-down'
    } else {
      this.container.appendChild(fragment)
      this.container.dataset.direction = 'bottom-up'
    }
  }

  private trimVisibleNodes(): void {
    while (this.activeRecords.length > this.maxVisibleItems) {
      const record = this.activeRecords.shift()

      if (!record) {
        break
      }

      this.markForRecycle(record)
    }
  }

  private markForRecycle(record: RenderRecord): void {
    const exists = this.activeRecords.findIndex((item) => item.id === record.id)
    if (exists >= 0) {
      this.activeRecords.splice(exists, 1)
    }

    if (!record.element.isConnected) {
      this.pool.release(record.element)
      return
    }

    record.element.classList.add('is-leaving')
    this.recycleQueue.push({
      element: record.element,
      releaseAt: Date.now() + 180,
    })
  }

  private renderMessage(element: HTMLDivElement, message: LiveMessage): void {
    const refs = this.pool.getRefs(element)
    const variant = resolveOpenLiveMessageVariant(message)
    const classes = [
      'overlay-render-item',
      `overlay-render-item--${message.type}`,
      message.provider === 'open-live' ? 'overlay-render-item--official' : '',
      variant !== 'default' && variant !== 'official' ? `overlay-render-item--${variant}` : '',
      this.settings.animationsEnabled ? 'is-animated' : '',
    ].filter(Boolean)

    element.className = classes.join(' ')
    element.dataset.provider = message.provider ?? 'public'
    element.dataset.command = message.rawCommand
    refs.name.textContent = message.username
    refs.content.textContent = message.content
    const metaText = resolveOpenLiveMessageTags(message).join(' · ')
    refs.meta.textContent = metaText
    refs.meta.hidden = !metaText

    if (message.type === 'superChat') {
      element.style.setProperty('--overlay-message-accent', message.priceColor)
    } else {
      element.style.removeProperty('--overlay-message-accent')
    }

    switch (message.type) {
      case 'gift':
        refs.badge.textContent = message.rawCommand === 'GUARD_BUY'
          ? message.guardLabel || 'Guard'
          : `${message.giftName} x${message.giftCount}`
        break
      case 'superChat':
        refs.badge.textContent = `SC ${message.price}`
        break
      case 'system':
        refs.badge.textContent = message.rawCommand === 'LIKE_INFO_V3_CLICK'
          ? 'LIKE'
          : message.rawCommand === 'ENTRY_EFFECT' || message.rawCommand === 'INTERACT_WORD'
            ? 'ENTRY'
            : message.systemKind.toUpperCase()
        break
      default:
        refs.badge.textContent = '弹幕'
        break
    }
  }

  private applySettings(): void {
    this.container.classList.add('overlay-render-layer')
    this.container.dataset.direction = this.settings.direction
    this.container.style.setProperty('--overlay-spacing', `${this.settings.messageSpacing}px`)
  }
}
