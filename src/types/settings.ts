import type { LiveProviderKind } from './live'

export type ThemeMode = 'dark' | 'obs' | 'neon' | 'bilibili'
export type MessageDirection = 'bottom-up' | 'top-down'
export type UpdateChannel = 'stable' | 'beta' | 'nightly'

export interface AppSettings {
  theme: ThemeMode
  liveProvider: LiveProviderKind
  openLiveIdentityCode: string
  obsMode: boolean
  autoReconnect: boolean
  fontSize: number
  fontWeight: number
  strokeWidth: number
  overlayOpacity: number
  overlayOffsetX: number
  overlayOffsetY: number
  overlayShadowBlur: number
  overlayShadowOpacity: number
  overlayCustomCss: string
  giftAccentStrength: number
  superChatAccentStrength: number
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
  updateChannel: UpdateChannel
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
