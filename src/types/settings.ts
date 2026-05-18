export type ThemeMode = 'dark'
export type MessageDirection = 'bottom-up' | 'top-down'

export interface AppSettings {
  theme: ThemeMode
  obsMode: boolean
  autoReconnect: boolean
  fontSize: number
  fontWeight: number
  strokeWidth: number
  overlayOpacity: number
  maxMessages: number
  animationsEnabled: boolean
  soundEnabled: boolean
  soundVolume: number
  direction: MessageDirection
  messageSpacing: number
  animationSpeed: number
  clickThrough: boolean
  alwaysOnTop: boolean
  minimizeToTray: boolean
  updaterEnabled: boolean
  autoCheckUpdates: boolean
  hideGift: boolean
  hideEntry: boolean
  hideSystem: boolean
  hideSuperChat: boolean
  dedupeEnabled: boolean
  dedupeWindowSeconds: number
  keywordFiltersText: string
  userBlacklistText: string
  customGiftSound: string
  customScSound: string
  customEntrySound: string
}

export interface WindowStateSnapshot {
  width: number
  height: number
  x: number
  y: number
}
