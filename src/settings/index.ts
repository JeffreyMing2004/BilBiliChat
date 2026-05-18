const SETTINGS_KEY = 'livedanmu.settings.v4'
const ROOMS_KEY = 'livedanmu.rooms.v4'
const ACTIVE_ROOM_KEY = 'livedanmu.active-room.v4'
const WINDOW_STATE_KEY = 'livedanmu.window-state.v4'
const AUTH_KEY = 'livedanmu.auth.v1'
const AUTH_PENDING_STATE_KEY = 'livedanmu.auth-pending-state.v1'

function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadStorageItem<T>(key: string, fallback: T): T {
  const storage = safeStorage()

  if (!storage) {
    return fallback
  }

  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveStorageItem<T>(key: string, value: T): void {
  const storage = safeStorage()

  if (!storage) {
    return
  }

  storage.setItem(key, JSON.stringify(value))
}

export function settingsStorageKey(): string {
  return SETTINGS_KEY
}

export function roomsStorageKey(): string {
  return ROOMS_KEY
}

export function activeRoomStorageKey(): string {
  return ACTIVE_ROOM_KEY
}

export function windowStateStorageKey(label = 'main'): string {
  return `${WINDOW_STATE_KEY}.${label}`
}

export function authStorageKey(): string {
  return AUTH_KEY
}

export function authPendingStateStorageKey(): string {
  return AUTH_PENDING_STATE_KEY
}
