<template>
  <footer class="status-bar glass-panel">
    <div class="status-item">
      <span>WebSocket 状态</span>
      <strong>{{ store.status.websocketState }}</strong>
    </div>
    <div class="status-item">
      <span>在线人数</span>
      <strong>{{ store.status.popularity.toLocaleString('zh-CN') }}</strong>
    </div>
    <div class="status-item">
      <span>当前房间号</span>
      <strong>{{ (store.status.resolvedRoomId ?? store.status.roomId) || '--' }}</strong>
    </div>
    <div class="status-item">
      <span>已接收消息</span>
      <strong>{{ store.status.messageCount }}</strong>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { useDanmuStore } from '../stores/danmu'

const store = useDanmuStore()
</script>
