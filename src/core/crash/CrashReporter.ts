import { loadStorageItem, saveStorageItem } from '../../settings'
import { getCurrentWindowLabel } from '../../windows/shared/manager'
import { logError, logInfo } from '../logger/Logger'
import { recoveryManager } from '../recovery/RecoveryManager'
import { windowBridge } from '../windows/WindowBridge'

export type CrashDomain = 'runtime' | 'overlay' | 'websocket' | 'window'

export interface CrashReport {
  id: string
  domain: CrashDomain
  source: string
  message: string
  stack: string
  occurredAt: number
  windowLabel: string
  fatal: boolean
  metadata: Record<string, unknown>
}

export interface CrashCaptureInput {
  domain: CrashDomain
  source: string
  message: string
  stack?: string
  fatal?: boolean
  windowLabel?: string
  metadata?: Record<string, unknown>
}

type CrashListener = (reports: CrashReport[]) => void

const CRASH_STORAGE_KEY = 'livedanmu.crash-report.v1'
const MAX_CRASH_REPORTS = 80

function normalizeError(error: unknown): { message: string; stack: string } {
  if (error instanceof Error) {
    return {
      message: error.message || error.name || '未知错误',
      stack: error.stack ?? '',
    }
  }

  if (typeof error === 'string') {
    return {
      message: error,
      stack: '',
    }
  }

  try {
    return {
      message: JSON.stringify(error),
      stack: '',
    }
  } catch {
    return {
      message: String(error),
      stack: '',
    }
  }
}

function safeWindowLabel(fallback?: string): string {
  if (fallback) {
    return fallback
  }

  try {
    return getCurrentWindowLabel()
  } catch {
    return 'unknown'
  }
}

export class CrashReporter {
  private reports = loadStorageItem<CrashReport[]>(CRASH_STORAGE_KEY, [])
  private readonly listeners = new Set<CrashListener>()
  private lastFingerprint = ''
  private lastCapturedAt = 0

  getReports(): CrashReport[] {
    return [...this.reports]
  }

  subscribe(listener: CrashListener): () => void {
    this.listeners.add(listener)
    listener(this.getReports())

    return () => {
      this.listeners.delete(listener)
    }
  }

  clear(): void {
    this.reports = []
    this.persist()
    this.notify()
  }

  remove(id: string): void {
    this.reports = this.reports.filter((report) => report.id !== id)
    this.persist()
    this.notify()
  }

  capture(input: CrashCaptureInput): CrashReport {
    const report: CrashReport = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      domain: input.domain,
      source: input.source,
      message: input.message,
      stack: input.stack ?? '',
      occurredAt: Date.now(),
      windowLabel: safeWindowLabel(input.windowLabel),
      fatal: input.fatal ?? false,
      metadata: input.metadata ?? {},
    }

    const fingerprint = [
      report.domain,
      report.source,
      report.message,
      report.windowLabel,
      report.fatal ? 'fatal' : 'soft',
    ].join('|')

    if (this.lastFingerprint === fingerprint && report.occurredAt - this.lastCapturedAt < 3_000) {
      return this.reports[0] ?? report
    }

    this.lastFingerprint = fingerprint
    this.lastCapturedAt = report.occurredAt
    this.reports = [report, ...this.reports].slice(0, MAX_CRASH_REPORTS)
    this.persist()
    this.notify()

    logError(
      'crash',
      `[${report.domain}] ${report.source}: ${report.message}`,
    )

    if (report.domain === 'overlay') {
      void recoveryManager.reportFailure('overlay', report.message)
    } else if (report.domain === 'websocket') {
      void recoveryManager.reportFailure('connection', report.message)
    } else if (report.domain === 'window' || report.domain === 'runtime') {
      void recoveryManager.reportFailure('window', report.message)
    }

    if (report.fatal && report.windowLabel !== 'crash') {
      void windowBridge.openWindow('crash').catch(() => undefined)
    }

    return report
  }

  captureError(
    domain: CrashDomain,
    source: string,
    error: unknown,
    options?: {
      fatal?: boolean
      windowLabel?: string
      metadata?: Record<string, unknown>
    },
  ): CrashReport {
    const normalized = normalizeError(error)

    return this.capture({
      domain,
      source,
      message: normalized.message,
      stack: normalized.stack,
      fatal: options?.fatal,
      windowLabel: options?.windowLabel,
      metadata: options?.metadata,
    })
  }

  installGlobalHandlers(windowLabel = safeWindowLabel()): () => void {
    const onError = (event: ErrorEvent) => {
      const normalized = normalizeError(event.error ?? event.message)

      this.capture({
        domain: 'window',
        source: event.filename || 'window.error',
        message: normalized.message,
        stack: normalized.stack,
        fatal: true,
        windowLabel,
        metadata: {
          colno: event.colno,
          lineno: event.lineno,
        },
      })
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const normalized = normalizeError(event.reason)

      this.capture({
        domain: 'runtime',
        source: 'unhandledrejection',
        message: normalized.message,
        stack: normalized.stack,
        fatal: true,
        windowLabel,
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    logInfo('crash', `CrashReporter 已安装全局监听: ${windowLabel}`)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }

  private persist(): void {
    saveStorageItem(CRASH_STORAGE_KEY, this.reports)
  }

  private notify(): void {
    const snapshot = this.getReports()
    this.listeners.forEach((listener) => listener(snapshot))
  }
}

export const crashReporter = new CrashReporter()

export function reportOverlayCrash(
  source: string,
  error: unknown,
  metadata?: Record<string, unknown>,
): CrashReport {
  return crashReporter.captureError('overlay', source, error, { metadata })
}

export function reportWebSocketCrash(
  source: string,
  error: unknown,
  metadata?: Record<string, unknown>,
): CrashReport {
  return crashReporter.captureError('websocket', source, error, { metadata })
}

export function reportWindowCrash(
  source: string,
  error: unknown,
  metadata?: Record<string, unknown>,
): CrashReport {
  return crashReporter.captureError('window', source, error, {
    fatal: true,
    metadata,
  })
}
