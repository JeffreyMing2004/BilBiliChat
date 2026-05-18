<template>
  <div
    class="window-shell danmu-window-shell"
    :class="{ 'is-obs-overlay': settingsStore.settings.obsMode }"
    :style="settingsStore.overlayStyleVars"
  >
    <header class="overlay-topbar">
      <div>
        <p class="eyebrow">
          Danmu Window
        </p>
        <h1>{{ activeRoom?.streamer?.name || 'LiveDanmu Overlay' }}</h1>
        <p class="window-subtitle">
          {{ activeRoom?.streamer?.title || '等待主控制台同步房间数据' }}
        </p>
      </div>

      <div class="overlay-topbar-actions">
        <el-tag
          :type="statusType"
          effect="dark"
        >
          {{ activeRoom?.statusText || '等待连接' }}
        </el-tag>
        <el-button
          plain
          @click="toggleObs"
        >
          {{ settingsStore.settings.obsMode ? '退出 OBS' : '开启 OBS' }}
        </el-button>
        <el-button
          plain
          @click="closeWindow"
        >
          关闭窗口
        </el-button>
      </div>
    </header>

    <DanmuList />

    <footer class="overlay-statusbar glass-panel">
      <div class="status-item">
        <span>当前人气值</span>
        <strong>{{ formatCount(activeRoom?.popularity) }}</strong>
      </div>
      <div class="status-item">
        <span>进房人数</span>
        <strong>{{ formatCount(activeRoom?.entryCount) }}</strong>
      </div>
      <div class="status-item">
        <span>当前在线人数</span>
        <strong>{{ formatCount(activeRoom?.onlineCount) }}</strong>
      </div>
      <div class="status-item">
        <span>当前房间号</span>
        <strong>{{ activeRoom?.resolvedRoomId || activeRoom?.roomIdInput || '--' }}</strong>
      </div>
      <div class="status-item">
        <span>WebSocket 延迟</span>
        <strong>{{ activeRoom ? `${activeRoom.wsLatency} ms` : '--' }}</strong>
      </div>
      <div class="status-item status-item--ranking">
        <span>贡献榜 TOP3</span>
        <strong>{{ topContributorSummary }}</strong>
      </div>
      <div class="status-item">
        <span>WebSocket 状态</span>
        <strong>{{ activeRoom?.websocketState || 'CLOSED' }}</strong>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'

import DanmuList from '../../components/DanmuList.vue'
import { useDanmuStore } from '../../stores/danmu'
import { useSettingsStore } from '../../stores/settings'
import { applyWindowPreferences, initializeWindowState } from '../../window'
import { closeCurrentWindow } from '../shared/manager'

const store = useDanmuStore()
const settingsStore = useSettingsStore()
const cleanups: Array<() => void> = []

const activeRoom = computed(() => store.activeRoom)
const topContributorSummary = computed(() => {
  if (!activeRoom.value?.topContributors.length) {
    return '暂无贡献记录'
  }

  return activeRoom.value.topContributors
    .map((item) => `#${item.rank} ${item.username} ${item.score.toFixed(2)}`)
    .join(' / ')
})
const statusType = computed(() => {
  switch (activeRoom.value?.status) {
    case 'connected':
      return 'success'
    case 'connecting':
    case 'reconnecting':
      return 'warning'
    case 'error':
      return 'danger'
    default:
      return 'info'
  }
})

function formatCount(value?: number): string {
  return (value ?? 0).toLocaleString('zh-CN')
}

function toggleObs(): void {
  settingsStore.toggleObsMode()
}

async function closeWindow(): Promise<void> {
  await closeCurrentWindow()
}

onMounted(async () => {
  settingsStore.initialize()
  await store.initialize()
  cleanups.push(await initializeWindowState())
  await applyWindowPreferences(settingsStore.settings)
})

watch(
  () => settingsStore.settings,
  (settings) => {
    void applyWindowPreferences(settings)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  cleanups.forEach((cleanup) => cleanup())
})
</script>
