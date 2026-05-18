<template>
  <footer class="app-footer glass-panel">
    <div class="footer-item">
      <span>WebSocket 状态</span>
      <strong>{{ status.status }}</strong>
    </div>
    <div class="footer-item">
      <span>当前服务器节点</span>
      <strong>{{ status.currentHost }}</strong>
    </div>
    <div class="footer-item">
      <span>错误信息</span>
      <strong>{{ status.lastError || '无' }}</strong>
    </div>
  </footer>
</template>

<script setup lang="ts">
import type { StatusSnapshot } from '../types/danmu'

defineProps<{
  status: StatusSnapshot
}>()
</script>
