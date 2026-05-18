<template>
  <component :is="currentWindowComponent" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import DanmuWindow from './windows/danmu/DanmuWindow.vue'
import LoginWindow from './windows/login/LoginWindow.vue'
import MainWindow from './windows/main/MainWindow.vue'
import SettingsWindow from './windows/settings/SettingsWindow.vue'
import { getCurrentWindowLabel } from './windows/shared/manager'

const currentWindowComponent = computed(() => {
  const label = getCurrentWindowLabel()

  if (label === 'danmu') {
    return DanmuWindow
  }

  if (label === 'settings') {
    return SettingsWindow
  }

  if (label === 'login') {
    return LoginWindow
  }

  return MainWindow
})
</script>
