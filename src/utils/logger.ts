import { logger, logDebug, logError, logInfo, logWarn } from '../core/logger/Logger'
import type { LogLevel, LogRecord, LogScope } from '../core/logger/Logger'

export type { LogLevel, LogRecord, LogScope }
export { logDebug, logError, logInfo, logger }

export function emitLog(level: LogLevel, scope: LogScope, message: string): LogRecord {
  return logger.log(level, scope, message)
}

export function logWarning(scope: LogScope, message: string): LogRecord {
  return logWarn(scope, message)
}

export function logSuccess(scope: LogScope, message: string): LogRecord {
  return logInfo(scope, message)
}

export function onLog(listener: (log: LogRecord) => void): () => void {
  return logger.onLog(listener)
}
