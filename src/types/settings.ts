export type ThemeMode = 'dark'
export type MessageDirection = 'bottom-up' | 'top-down'

export interface AppSettings {
  theme: ThemeMode
  obsMode: boolean
  autoReconnect: boolean
  fontSize: number
  overlayOpacity: number
  maxMessages: number
  animationsEnabled: boolean
  soundEnabled: boolean
  direction: MessageDirection
  messageSpacing: number
  animationSpeed: number
  clickThrough: boolean
  alwaysOnTop: boolean
  minimizeToTray: boolean
  hideGift: boolean
  hideEntry: boolean
  hideSystem: boolean
  keywordFiltersText: string
  userBlacklistText: string
}

export interface WindowStateSnapshot {
  width: number
  height: number
  x: number
  y: number
}
