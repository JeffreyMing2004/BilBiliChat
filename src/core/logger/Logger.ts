import { formatTime } from '../../utils/time'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'
export type LogScope =
  | 'connection'
  | 'websocket'
  | 'message'
  | 'store'
  | 'rooms'
  | 'windows'
  | 'service'
  | 'eventbus'
  | 'overlay'
  | 'performance'
  | 'plugin'
  | 'live'
  | 'recovery'
  | 'design'
  | 'crash'

export interface LogRecord {
  id: string
  level: LogLevel
  scope: LogScope
  message: string
  time: string
}

type LogListener = (record: LogRecord) => void

class Logger {
  private readonly listeners = new Set<LogListener>()

  log(level: LogLevel, scope: LogScope, message: string): LogRecord {
    const record: LogRecord = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      level,
      scope,
      message,
      time: formatTime(),
    }

    const prefix = `[LiveDanmu][${scope}][${level}]`
    if (level === 'error') {
      console.error(prefix, message)
    } else if (level === 'warn') {
      console.warn(prefix, message)
    } else if (level === 'debug') {
      console.debug(prefix, message)
    } else {
      console.info(prefix, message)
    }

    this.listeners.forEach((listener) => listener(record))
    return record
  }

  onLog(listener: LogListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

export const logger = new Logger()

export function logInfo(scope: LogScope, message: string): LogRecord {
  return logger.log('info', scope, message)
}

export function logWarn(scope: LogScope, message: string): LogRecord {
  return logger.log('warn', scope, message)
}

export function logError(scope: LogScope, message: string): LogRecord {
  return logger.log('error', scope, message)
}

export function logDebug(scope: LogScope, message: string): LogRecord {
  return logger.log('debug', scope, message)
}
