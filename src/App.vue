<template>
  <component :is="currentWindowComponent" />
  <UpdateDialog v-if="shouldMountUpdateDialog" />
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { getVersion } from '@tauri-apps/api/app'

import UpdateDialog from './components/UpdateDialog.vue'
import DebugWindow from './windows/debug/DebugWindow.vue'
import CrashWindow from './windows/crash/CrashWindow.vue'
import DanmuWindow from './windows/danmu/DanmuWindow.vue'
import LoginWindow from './windows/login/LoginWindow.vue'
import MainWindow from './windows/main/MainWindow.vue'
import OverlayStudioWindow from './windows/overlay-studio/OverlayStudioWindow.vue'
import SettingsWindow from './windows/settings/SettingsWindow.vue'
import { initializeUpdater, maybeAutoCheckForUpdates, setUpdateChannel } from './modules/updater'
import { useSettingsStore } from './stores/settings'
import { getCurrentWindowLabel } from './windows/shared/manager'

const settingsStore = useSettingsStore()
settingsStore.initialize()

watch(
  () => [settingsStore.settings.theme, settingsStore.settings.obsMode],
  ([theme, obsMode]) => {
    document.documentElement.dataset.theme = obsMode ? 'obs' : String(theme)
  },
  { immediate: true },
)

const currentWindowLabel = computed(() => getCurrentWindowLabel())
const shouldMountUpdateDialog = computed(() => (
  currentWindowLabel.value === 'main' || currentWindowLabel.value === 'settings'
))

const currentWindowComponent = computed(() => {
  const label = currentWindowLabel.value

  if (label === 'danmu') {
    return DanmuWindow
  }

  if (label === 'settings') {
    return SettingsWindow
  }

  if (label === 'login') {
    return LoginWindow
  }

  if (label === 'debug') {
    return DebugWindow
  }

  if (label === 'crash') {
    return CrashWindow
  }

  if (label === 'overlay-studio') {
    return OverlayStudioWindow
  }

  return MainWindow
})

onMounted(async () => {
  if (currentWindowLabel.value !== 'main') {
    return
  }

  await initializeUpdater(await getVersion())
  setUpdateChannel(settingsStore.settings.updateChannel)
  await maybeAutoCheckForUpdates(settingsStore.settings)
})
</script>
