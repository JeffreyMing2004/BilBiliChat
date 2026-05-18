import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { settingsStorageKey } from '../settings'
import { DEFAULT_SETTINGS, normalizeSettings, settingsManager, splitTextList } from '../modules/settings'
import type { AppSettings } from '../types/settings'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>(DEFAULT_SETTINGS)
  const initialized = ref(false)
  const settingsVisible = ref(false)
  let storageBound = false

  const keywordFilters = computed(() => splitTextList(settings.value.keywordFiltersText))
  const userBlacklist = computed(() => splitTextList(settings.value.userBlacklistText))
  const overlayStyleVars = computed<Record<string, string>>(() => settingsManager.toStyleVars(settings.value))

  function persist(): void {
    settingsManager.save(settings.value)
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

    settings.value = settingsManager.load()
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
    settings.value = settingsManager.reset()
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
