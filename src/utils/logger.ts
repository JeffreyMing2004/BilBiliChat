import { formatTime } from './time'

export type LogLevel = 'info' | 'success' | 'warning' | 'error'
export type LogScope = 'connection' | 'websocket' | 'message' | 'store'

export interface LogRecord {
  id: string
  level: LogLevel
  scope: LogScope
  message: string
  time: string
}

const listeners = new Set<(log: LogRecord) => void>()

function createLog(level: LogLevel, scope: LogScope, message: string): LogRecord {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    level,
    scope,
    message,
    time: formatTime(),
  }
}

export function emitLog(level: LogLevel, scope: LogScope, message: string): LogRecord {
  const record = createLog(level, scope, message)
  const prefix = `[LiveDanmu][${scope}][${level}]`

  if (level === 'error') {
    console.error(prefix, message)
  } else if (level === 'warning') {
    console.warn(prefix, message)
  } else {
    console.log(prefix, message)
  }

  listeners.forEach((listener) => listener(record))
  return record
}

export function logInfo(scope: LogScope, message: string): LogRecord {
  return emitLog('info', scope, message)
}

export function logSuccess(scope: LogScope, message: string): LogRecord {
  return emitLog('success', scope, message)
}

export function logWarning(scope: LogScope, message: string): LogRecord {
  return emitLog('warning', scope, message)
}

export function logError(scope: LogScope, message: string): LogRecord {
  return emitLog('error', scope, message)
}

export function onLog(listener: (log: LogRecord) => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
