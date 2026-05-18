<template>
  <div class="app-shell">
    <RoomConnect />
    <DanmuList />
    <StatusBar />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import DanmuList from '../components/DanmuList.vue'
import RoomConnect from '../components/RoomConnect.vue'
import StatusBar from '../components/StatusBar.vue'
import { useDanmuStore } from '../stores/danmu'

const store = useDanmuStore()

onMounted(() => {
  void store.initialize()
})
</script>
