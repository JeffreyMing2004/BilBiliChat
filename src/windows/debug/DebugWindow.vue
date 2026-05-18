<template>
  <div class="window-shell debug-shell">
    <section class="debug-panel glass-panel">
      <div class="dashboard-card-head">
        <div>
          <p class="eyebrow">
            Debug Window
          </p>
          <h2>运行监控与调试面板</h2>
        </div>
        <el-button
          plain
          @click="closeWindow"
        >
          关闭窗口
        </el-button>
      </div>

      <div class="info-grid">
        <div class="info-cell">
          <span>当前 FPS</span>
          <strong>{{ snapshot.fps }}</strong>
        </div>
        <div class="info-cell">
          <span>DOM 数量</span>
          <strong>{{ snapshot.domCount }}</strong>
        </div>
        <div class="info-cell">
          <span>消息速率</span>
          <strong>{{ snapshot.messageRate }}/s</strong>
        </div>
        <div class="info-cell">
          <span>渲染耗时</span>
          <strong>{{ snapshot.overlayRenderMs }} ms</strong>
        </div>
        <div class="info-cell">
          <span>WebSocket 延迟</span>
          <strong>{{ snapshot.wsLatency }} ms</strong>
        </div>
        <div class="info-cell">
          <span>内存使用</span>
          <strong>{{ snapshot.memoryUsageMB || '--' }} MB</strong>
        </div>
        <div class="info-cell">
          <span>消息队列</span>
          <strong>{{ snapshot.queueSize }}</strong>
        </div>
        <div class="info-cell">
          <span>丢弃消息</span>
          <strong>{{ snapshot.droppedMessages }}</strong>
        </div>
        <div class="info-cell">
          <span>连接状态</span>
          <strong>{{ snapshot.connectionStatus }}</strong>
        </div>
        <div class="info-cell">
          <span>房间数量</span>
          <strong>{{ store.roomList.length }}</strong>
        </div>
        <div class="info-cell">
          <span>Overlay 状态</span>
          <strong>{{ snapshot.overlayMounted ? '运行中' : '未挂载' }}</strong>
        </div>
        <div class="info-cell">
          <span>当前房间</span>
          <strong>{{ store.activeRoom?.resolvedRoomId || store.activeRoom?.roomIdInput || '--' }}</strong>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive } from 'vue'

import { performanceMonitor } from '../../core/performance/PerformanceMonitor'
import { useDanmuStore } from '../../stores/danmu'
import { useSettingsStore } from '../../stores/settings'
import { closeCurrentWindow } from '../shared/manager'

const store = useDanmuStore()
const settingsStore = useSettingsStore()
const snapshot = reactive(performanceMonitor.getSnapshot())
let unlisten: (() => void) | null = null

async function closeWindow(): Promise<void> {
  await closeCurrentWindow()
}

onMounted(async () => {
  settingsStore.initialize()
  await store.initialize()
  performanceMonitor.start()
  unlisten = performanceMonitor.subscribe((nextSnapshot) => {
    Object.assign(snapshot, nextSnapshot)
  })
})

onBeforeUnmount(() => {
  unlisten?.()
})
</script>
