<template>
  <footer class="panel footer-panel">
    <div class="footer-item">
      <span>WebSocket 状态</span>
      <strong>{{ status.websocketState }}</strong>
    </div>
    <div class="footer-item">
      <span>连接状态</span>
      <strong>{{ status.status }}</strong>
    </div>
    <div class="footer-item">
      <span>在线人数</span>
      <strong>{{ status.popularity.toLocaleString('zh-CN') }}</strong>
    </div>
  </footer>
</template>

<script setup lang="ts">
import type { StatusSnapshot } from '../types/danmu'

defineProps<{
  status: StatusSnapshot
}>()
</script>
