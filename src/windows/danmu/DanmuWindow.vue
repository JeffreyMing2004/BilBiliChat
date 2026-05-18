<template>
  <div
    class="window-shell danmu-window-shell"
    :class="{ 'is-obs-overlay': settingsStore.settings.obsMode }"
    :style="settingsStore.overlayStyleVars"
  >
    <header class="overlay-topbar">
      <div data-tauri-drag-region>
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

    <section class="danmu-panel danmu-panel--embedded glass-panel">
      <div
        ref="overlayRoot"
        class="overlay-render-root"
      />
    </section>

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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import { OverlayStyleEngine } from '../../core/overlay/css/OverlayStyleEngine'
import { logError } from '../../core/logger/Logger'
import { OverlayRenderer } from '../../core/overlay/renderer/OverlayRenderer'
import { performanceMonitor } from '../../core/performance/PerformanceMonitor'
import { recoveryManager } from '../../core/recovery/RecoveryManager'
import { useDanmuStore } from '../../stores/danmu'
import { useSettingsStore } from '../../stores/settings'
import { applyWindowPreferences, initializeWindowState } from '../../window'
import { closeCurrentWindow } from '../shared/manager'

const store = useDanmuStore()
const settingsStore = useSettingsStore()
const cleanups: Array<() => void> = []
const overlayRoot = ref<HTMLElement | null>(null)
let overlayRenderer: OverlayRenderer | null = null
let overlayStyleEngine: OverlayStyleEngine | null = null
let renderedRoomId = ''
let renderedMessageCount = 0
let renderedLastMessageId = ''

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
  try {
    await closeCurrentWindow()
  } catch (error) {
    const message = error instanceof Error ? error.message : '关闭弹幕窗口失败'
    logError('windows', message)
    ElMessage.error(message)
  }
}

function syncPerformanceState(): void {
  performanceMonitor.updateRoomCount(store.roomList.length)
  performanceMonitor.updateConnectionStatus(activeRoom.value?.status ?? 'idle')
  performanceMonitor.updateLatency(activeRoom.value?.wsLatency ?? 0)
}

function syncOverlay(force = false): void {
  if (!overlayRenderer) {
    return
  }

  const room = activeRoom.value
  if (!room) {
    overlayRenderer.clear()
    renderedRoomId = ''
    renderedMessageCount = 0
    renderedLastMessageId = ''
    syncPerformanceState()
    return
  }

  const lastMessageId = room.messages.at(-1)?.id ?? ''
  const shouldReplace = force
    || renderedRoomId !== room.id
    || room.messages.length < renderedMessageCount
    || (room.messages.length === renderedMessageCount && renderedLastMessageId !== lastMessageId)

  if (shouldReplace) {
    overlayRenderer.replaceMessages(room.messages)
  } else if (room.messages.length > renderedMessageCount) {
    room.messages.slice(renderedMessageCount).forEach((message) => {
      overlayRenderer?.enqueue(message)
    })
  }

  renderedRoomId = room.id
  renderedMessageCount = room.messages.length
  renderedLastMessageId = lastMessageId
  syncPerformanceState()
}

function ensureOverlayRenderer(): void {
  if (!overlayRoot.value) {
    return
  }

  overlayStyleEngine?.destroy()
  overlayRenderer?.destroy()
  overlayStyleEngine = new OverlayStyleEngine({
    target: overlayRoot.value,
    theme: settingsStore.settings.theme === 'neon' ? 'neon' : 'dark',
    settings: settingsStore.settings,
  })
  overlayRenderer = new OverlayRenderer({
    container: overlayRoot.value,
    settings: settingsStore.settings,
    performanceMonitor,
    maxVisibleItems: Math.min(settingsStore.settings.maxMessages, 48),
    maxQueueSize: Math.min(settingsStore.settings.maxMessages * 2, 200),
  })
  performanceMonitor.updateOverlayMounted(true)
}

onMounted(async () => {
  settingsStore.initialize()
  await store.initialize()
  cleanups.push(await initializeWindowState())
  cleanups.push(recoveryManager.register('overlay', 'danmu-window-overlay', async () => {
    ensureOverlayRenderer()
    syncOverlay(true)
  }))
  recoveryManager.captureWindow('danmu', true)
  ensureOverlayRenderer()
  syncOverlay(true)
  await applyWindowPreferences(settingsStore.settings)
})

watch(
  () => settingsStore.settings,
  (settings) => {
    overlayRenderer?.updateSettings(settings)
    overlayStyleEngine?.updateSettings(settings)
    void applyWindowPreferences(settings)
  },
  { deep: true },
)

watch(
  () => [
    activeRoom.value?.id ?? '',
    activeRoom.value?.messages.length ?? 0,
    activeRoom.value?.messages.at(-1)?.id ?? '',
    store.roomList.length,
    activeRoom.value?.status ?? 'idle',
    activeRoom.value?.wsLatency ?? 0,
  ],
  () => {
    syncOverlay()
  },
)

onBeforeUnmount(() => {
  recoveryManager.captureWindow('danmu', false)
  performanceMonitor.updateOverlayMounted(false)
  overlayRenderer?.destroy()
  overlayStyleEngine?.destroy()
  cleanups.forEach((cleanup) => cleanup())
})
</script>
