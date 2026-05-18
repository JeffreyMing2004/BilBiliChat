import { formatTime } from './time'

export type LogLevel = 'info' | 'success' | 'warning' | 'error'

export interface LogRecord {
  id: string
  level: LogLevel
  message: string
  time: string
}

const listeners = new Set<(log: LogRecord) => void>()

export function emitLog(level: LogLevel, message: string): LogRecord {
  const record = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    level,
    message,
    time: formatTime(),
  }

  listeners.forEach((listener) => listener(record))

  return record
}

export function onLog(listener: (log: LogRecord) => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
