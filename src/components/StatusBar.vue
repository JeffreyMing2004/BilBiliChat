<template>
  <footer class="status-bar glass-panel">
    <div class="status-item">
      <span>WebSocket 状态</span>
      <strong>{{ store.activeRoom?.websocketState ?? 'CLOSED' }}</strong>
    </div>
    <div class="status-item">
      <span>在线人数</span>
      <strong>{{ (store.activeRoom?.popularity ?? 0).toLocaleString('zh-CN') }}</strong>
    </div>
    <div class="status-item">
      <span>当前房间号</span>
      <strong>{{ (store.activeRoom?.resolvedRoomId ?? store.activeRoom?.roomIdInput) || '--' }}</strong>
    </div>
    <div class="status-item">
      <span>已接收消息</span>
      <strong>{{ store.activeRoom?.messageCount ?? 0 }}</strong>
    </div>
    <div class="status-item">
      <span>当前模式</span>
      <strong>{{ settingsStore.settings.obsMode ? 'OBS Overlay' : '桌面模式' }}</strong>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { useDanmuStore } from '../stores/danmu'
import { useSettingsStore } from '../stores/settings'

const store = useDanmuStore()
const settingsStore = useSettingsStore()
</script>
