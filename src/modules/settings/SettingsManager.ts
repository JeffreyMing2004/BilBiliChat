import { loadStorageItem, saveStorageItem, settingsStorageKey } from '../../settings'
import type { AppSettings } from '../../types/settings'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  obsMode: false,
  autoReconnect: true,
  fontSize: 28,
  fontWeight: 700,
  strokeWidth: 2,
  overlayOpacity: 88,
  maxMessages: 500,
  animationsEnabled: true,
  soundEnabled: false,
  soundVolume: 70,
  direction: 'bottom-up',
  messageSpacing: 12,
  animationSpeed: 1,
  clickThrough: false,
  alwaysOnTop: false,
  minimizeToTray: true,
  updaterEnabled: true,
  autoCheckUpdates: true,
  hideGift: false,
  hideEntry: false,
  hideSystem: false,
  hideSuperChat: false,
  dedupeEnabled: true,
  dedupeWindowSeconds: 8,
  keywordFiltersText: '',
  userBlacklistText: '',
  customGiftSound: '',
  customScSound: '',
  customEntrySound: '',
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function splitTextList(input: string): string[] {
  return input
    .split(/[\n,，]/g)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

export function normalizeSettings(input: Partial<AppSettings>): AppSettings {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...input,
  }

  return {
    ...merged,
    fontSize: clamp(Number(merged.fontSize), 18, 72),
    fontWeight: clamp(Number(merged.fontWeight), 400, 900),
    strokeWidth: clamp(Number(merged.strokeWidth), 0, 6),
    overlayOpacity: clamp(Number(merged.overlayOpacity), 5, 100),
    maxMessages: clamp(Number(merged.maxMessages), 100, 1000),
    soundVolume: clamp(Number(merged.soundVolume), 0, 100),
    messageSpacing: clamp(Number(merged.messageSpacing), 4, 36),
    animationSpeed: clamp(Number(merged.animationSpeed), 0.2, 2.5),
    dedupeWindowSeconds: clamp(Number(merged.dedupeWindowSeconds), 1, 60),
  }
}

export class SettingsManager {
  load(): AppSettings {
    return normalizeSettings(loadStorageItem(settingsStorageKey(), DEFAULT_SETTINGS))
  }

  save(settings: AppSettings): void {
    saveStorageItem(settingsStorageKey(), normalizeSettings(settings))
  }

  reset(): AppSettings {
    const settings = normalizeSettings(DEFAULT_SETTINGS)
    this.save(settings)
    return settings
  }

  toStyleVars(settings: AppSettings): Record<string, string> {
    return {
      '--overlay-font-size': `${settings.fontSize}px`,
      '--overlay-font-weight': String(settings.fontWeight),
      '--overlay-stroke-width': `${settings.strokeWidth}px`,
      '--overlay-opacity': String(settings.overlayOpacity / 100),
      '--overlay-spacing': `${settings.messageSpacing}px`,
      '--overlay-animation-speed': `${settings.animationSpeed}s`,
    }
  }
}

export const settingsManager = new SettingsManager()
