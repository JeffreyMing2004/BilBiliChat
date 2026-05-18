import type { CrashReport } from './CrashReporter'
import { logInfo } from '../logger/Logger'

const sentryConfig = {
  dsn: import.meta.env.VITE_SENTRY_DSN ?? '',
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? 'beta',
  release: import.meta.env.VITE_SENTRY_RELEASE ?? '0.1.0-beta',
}

export class SentryBridge {
  get enabled(): boolean {
    return Boolean(sentryConfig.dsn)
  }

  initialize(): void {
    if (!this.enabled) {
      return
    }

    logInfo('crash', `Sentry 预留已启用: ${sentryConfig.environment}`)
  }

  captureCrash(report: CrashReport): void {
    if (!this.enabled) {
      return
    }

    logInfo('crash', `Sentry capture reserved for ${report.domain}:${report.source}`)
  }
}

export const sentryBridge = new SentryBridge()
