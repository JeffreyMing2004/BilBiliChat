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

    <section class="debug-panel glass-panel">
      <OpenLiveStatusPanel
        :room="store.activeRoom"
        :identity-code="settingsStore.settings.openLiveIdentityCode"
      />

      <div
        v-if="store.activeRoom?.providerKind === 'open-live'"
        class="debug-openlive"
      >
        <div class="debug-openlive__column">
          <h3>协议日志</h3>
          <div class="debug-openlive__list">
            <template v-if="protocolRecords.length">
              <article
                v-for="record in protocolRecords"
                :key="record.id"
                class="debug-openlive__item"
              >
                <header>
                  <strong>{{ record.command }}</strong>
                  <span>{{ formatTime(record.createdAt) }}</span>
                </header>
                <p>{{ record.message }}</p>
              </article>
            </template>
            <p
              v-else
              class="debug-openlive__empty"
            >
              暂无协议日志，连接 OpenLive 后这里会显示认证、重连、心跳和会话记录。
            </p>
          </div>
        </div>

        <div class="debug-openlive__column">
          <h3>原始事件 JSON</h3>
          <div class="debug-openlive__list">
            <template v-if="rawRecords.length">
              <article
                v-for="record in rawRecords"
                :key="record.id"
                class="debug-openlive__item"
              >
                <header>
                  <strong>{{ record.command }}</strong>
                  <span>{{ formatTime(record.createdAt) }}</span>
                </header>
                <pre>{{ serializePayload(record.payload) }}</pre>
              </article>
            </template>
            <p
              v-else
              class="debug-openlive__empty"
            >
              暂无原始事件，收到 OpenLive JSON 后这里会实时展示官方载荷。
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { ElMessage } from 'element-plus'

import { logError } from '../../core/logger/Logger'
import OpenLiveStatusPanel from '../../modules/openlive/OpenLiveStatusPanel.vue'
import { performanceMonitor } from '../../core/performance/PerformanceMonitor'
import { useDanmuStore } from '../../stores/danmu'
import { useSettingsStore } from '../../stores/settings'
import { formatTime as formatTimestamp } from '../../utils/time'
import { closeCurrentWindow } from '../shared/manager'

const store = useDanmuStore()
const settingsStore = useSettingsStore()
const snapshot = reactive(performanceMonitor.getSnapshot())
let unlisten: (() => void) | null = null
const protocolRecords = computed(() => (store.activeRoom?.openLiveDebugRecords ?? []).filter((record) => record.type !== 'raw').slice(0, 12))
const rawRecords = computed(() => (store.activeRoom?.openLiveDebugRecords ?? []).filter((record) => record.type === 'raw').slice(0, 12))

function formatTime(timestamp: number): string {
  return formatTimestamp(new Date(timestamp))
}

function serializePayload(payload: unknown): string {
  if (!payload) {
    return '{}'
  }

  return JSON.stringify(payload, null, 2)
}

async function closeWindow(): Promise<void> {
  try {
    await closeCurrentWindow()
  } catch (error) {
    const message = error instanceof Error ? error.message : '关闭调试窗口失败'
    logError('windows', message)
    ElMessage.error(message)
  }
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
