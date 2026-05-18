export interface PerformanceSnapshot {
  fps: number
  domCount: number
  wsLatency: number
  memoryUsageMB: number
  messageRate: number
  overlayRenderMs: number
  roomCount: number
  queueSize: number
  droppedMessages: number
  connectionStatus: string
  overlayMounted: boolean
  updatedAt: number
}

type PerformanceListener = (snapshot: PerformanceSnapshot) => void

function readMemoryUsageMB(): number {
  const memory = (performance as Performance & {
    memory?: { usedJSHeapSize?: number }
  }).memory

  if (!memory?.usedJSHeapSize) {
    return 0
  }

  return Math.round((memory.usedJSHeapSize / 1024 / 1024) * 10) / 10
}

export class PerformanceMonitor {
  private readonly listeners = new Set<PerformanceListener>()
  private rafId: number | null = null
  private running = false
  private frameCounter = 0
  private messageCounter = 0
  private lastSampleAt = performance.now()
  private snapshot: PerformanceSnapshot = {
    fps: 0,
    domCount: 0,
    wsLatency: 0,
    memoryUsageMB: 0,
    messageRate: 0,
    overlayRenderMs: 0,
    roomCount: 0,
    queueSize: 0,
    droppedMessages: 0,
    connectionStatus: 'idle',
    overlayMounted: false,
    updatedAt: Date.now(),
  }

  subscribe(listener: PerformanceListener): () => void {
    this.listeners.add(listener)
    listener({ ...this.snapshot })

    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): PerformanceSnapshot {
    return { ...this.snapshot }
  }

  start(): void {
    if (this.running) {
      return
    }

    this.running = true
    this.lastSampleAt = performance.now()
    this.loop()
  }

  stop(): void {
    this.running = false

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  recordFrame(renderDurationMs: number): void {
    this.frameCounter += 1
    this.snapshot.overlayRenderMs = Math.round(renderDurationMs * 100) / 100
  }

  recordMessage(count = 1): void {
    this.messageCounter += count
  }

  updateDomCount(domCount: number): void {
    this.snapshot.domCount = domCount
  }

  updateLatency(latency: number): void {
    this.snapshot.wsLatency = latency
  }

  updateRoomCount(roomCount: number): void {
    this.snapshot.roomCount = roomCount
  }

  updateQueue(queueSize: number, droppedMessages?: number): void {
    this.snapshot.queueSize = queueSize
    if (typeof droppedMessages === 'number') {
      this.snapshot.droppedMessages = droppedMessages
    }
  }

  updateConnectionStatus(status: string): void {
    this.snapshot.connectionStatus = status
  }

  updateOverlayMounted(mounted: boolean): void {
    this.snapshot.overlayMounted = mounted
  }

  private emit(): void {
    this.snapshot.updatedAt = Date.now()
    this.listeners.forEach((listener) => listener({ ...this.snapshot }))
  }

  private loop = (): void => {
    if (!this.running) {
      return
    }

    const now = performance.now()
    const elapsed = now - this.lastSampleAt
    if (elapsed >= 1000) {
      this.snapshot.fps = Math.round((this.frameCounter * 1000) / elapsed)
      this.snapshot.messageRate = Math.round((this.messageCounter * 1000) / elapsed)
      this.snapshot.memoryUsageMB = readMemoryUsageMB()
      this.frameCounter = 0
      this.messageCounter = 0
      this.lastSampleAt = now
      this.emit()
    }

    this.rafId = requestAnimationFrame(this.loop)
  }

  destroy(): void {
    this.stop()
    this.listeners.clear()
  }
}

export const performanceMonitor = new PerformanceMonitor()
