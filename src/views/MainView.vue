<template>
  <div class="app-shell">
    <ConnectionPanel />
    <DanmuList />
    <AppFooter :status="store.status" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import AppFooter from '../components/AppFooter.vue'
import ConnectionPanel from '../components/ConnectionPanel.vue'
import DanmuList from '../components/DanmuList.vue'
import { useDanmuStore } from '../stores/danmu'

const store = useDanmuStore()

onMounted(() => {
  void store.initialize()
})
</script>
