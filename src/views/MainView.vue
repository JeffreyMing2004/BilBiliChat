<template>
  <div
    class="app-shell"
    :class="shellClasses"
    :style="settingsStore.overlayStyleVars"
  >
    <template v-if="!settingsStore.settings.obsMode">
      <RoomTabs />
      <RoomConnect />
    </template>
    <DanmuList />
    <StatusBar v-if="!settingsStore.settings.obsMode" />
    <SettingsDrawer />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'

import DanmuList from '../components/DanmuList.vue'
import RoomConnect from '../components/RoomConnect.vue'
import RoomTabs from '../components/RoomTabs.vue'
import SettingsDrawer from '../components/SettingsDrawer.vue'
import StatusBar from '../components/StatusBar.vue'
import { overlayClassName } from '../overlay'
import { useDanmuStore } from '../stores/danmu'
import { useSettingsStore } from '../stores/settings'
import { initializeTrayListeners } from '../tray'
import { initializeShortcuts } from '../window/shortcuts'
import { applyWindowPreferences, initializeWindowState } from '../window'

const store = useDanmuStore()
const settingsStore = useSettingsStore()
const shellClasses = computed(() => overlayClassName(settingsStore.settings))

const cleanups: Array<() => void> = []

onMounted(async () => {
  settingsStore.initialize()
  await store.initialize()
  cleanups.push(await initializeWindowState())
  cleanups.push(await initializeTrayListeners({
    onToggleObs: () => settingsStore.toggleObsMode(),
    onOpenSettings: () => settingsStore.setSettingsVisible(true),
  }))
  cleanups.push(initializeShortcuts({
    reconnect: () => store.reconnectActiveRoom(),
    clearMessages: () => store.clearActiveMessages(),
    toggleObs: () => settingsStore.toggleObsMode(),
    openSettings: () => settingsStore.setSettingsVisible(true),
  }))

  await applyWindowPreferences(settingsStore.settings)
})

watch(
  () => settingsStore.settings,
  (settings) => {
    store.applyMessageLimit(settings.maxMessages)
    void applyWindowPreferences(settings)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  cleanups.forEach((cleanup) => cleanup())
})
</script>
