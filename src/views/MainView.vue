<template>
  <div class="app-shell">
    <AppHeader @open-settings="settingsVisible = true" />

    <main class="app-main">
      <aside class="left-column">
        <ConnectionPanel />
        <StatusPanel :status="store.status" />
        <LogPanel />
      </aside>

      <section class="right-column">
        <DanmuList />
      </section>
    </main>

    <AppFooter :status="store.status" />
    <SettingsDrawer v-model="settingsVisible" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import AppFooter from '../components/AppFooter.vue'
import AppHeader from '../components/AppHeader.vue'
import ConnectionPanel from '../components/ConnectionPanel.vue'
import DanmuList from '../components/DanmuList.vue'
import LogPanel from '../components/LogPanel.vue'
import SettingsDrawer from '../components/SettingsDrawer.vue'
import StatusPanel from '../components/StatusPanel.vue'
import { useDanmuStore } from '../stores/danmu'

const store = useDanmuStore()
const settingsVisible = ref(false)

onMounted(() => {
  void store.initialize()
})
</script>
