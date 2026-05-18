import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { loadStorageItem, saveStorageItem, settingsStorageKey } from '../settings'
import type { AppSettings } from '../types/settings'

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  obsMode: false,
  autoReconnect: true,
  fontSize: 28,
  overlayOpacity: 88,
  maxMessages: 500,
  animationsEnabled: true,
  soundEnabled: false,
  direction: 'bottom-up',
  messageSpacing: 12,
  animationSpeed: 1,
  clickThrough: false,
  alwaysOnTop: false,
  minimizeToTray: true,
  hideGift: false,
  hideEntry: false,
  hideSystem: false,
  keywordFiltersText: '',
  userBlacklistText: '',
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeSettings(input: AppSettings): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    fontSize: clamp(input.fontSize, 18, 64),
    overlayOpacity: clamp(input.overlayOpacity, 10, 100),
    maxMessages: clamp(input.maxMessages, 100, 500),
    messageSpacing: clamp(input.messageSpacing, 4, 32),
    animationSpeed: clamp(input.animationSpeed, 0.4, 1.8),
  }
}

function splitFilterText(input: string): string[] {
  return input
    .split(/[\n,，]/g)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>(DEFAULT_SETTINGS)
  const initialized = ref(false)
  const settingsVisible = ref(false)
  let storageBound = false

  const keywordFilters = computed(() => splitFilterText(settings.value.keywordFiltersText))
  const userBlacklist = computed(() => splitFilterText(settings.value.userBlacklistText))
  const overlayStyleVars = computed<Record<string, string>>(() => ({
    '--overlay-font-size': `${settings.value.fontSize}px`,
    '--overlay-opacity': String(settings.value.overlayOpacity / 100),
    '--overlay-spacing': `${settings.value.messageSpacing}px`,
    '--overlay-animation-speed': `${settings.value.animationSpeed}s`,
  }))

  function persist(): void {
    saveStorageItem(settingsStorageKey(), settings.value)
  }

  function bindStorageSync(): void {
    if (storageBound) {
      return
    }

    window.addEventListener('storage', (event) => {
      if (event.key !== settingsStorageKey() || !event.newValue) {
        return
      }

      try {
        settings.value = normalizeSettings(JSON.parse(event.newValue) as AppSettings)
      } catch {
        settings.value = DEFAULT_SETTINGS
      }
    })
    storageBound = true
  }

  function initialize(): void {
    if (initialized.value) {
      return
    }

    settings.value = normalizeSettings(loadStorageItem(settingsStorageKey(), DEFAULT_SETTINGS))
    bindStorageSync()
    initialized.value = true
  }

  function patchSettings(partial: Partial<AppSettings>): void {
    settings.value = normalizeSettings({
      ...settings.value,
      ...partial,
    })
    persist()
  }

  function resetSettings(): void {
    settings.value = DEFAULT_SETTINGS
    persist()
  }

  function toggleObsMode(force?: boolean): void {
    patchSettings({ obsMode: force ?? !settings.value.obsMode })
  }

  function setSettingsVisible(visible: boolean): void {
    settingsVisible.value = visible
  }

  return {
    initialized,
    keywordFilters,
    overlayStyleVars,
    settings,
    settingsVisible,
    userBlacklist,
    initialize,
    patchSettings,
    resetSettings,
    setSettingsVisible,
    toggleObsMode,
  }
})
