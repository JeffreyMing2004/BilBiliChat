<template>
  <section class="control-panel glass-panel">
    <div class="panel-toolbar">
      <div class="title-wrap">
        <p class="eyebrow">
          LiveDanmu
        </p>
        <h1>直播互动控制台</h1>
      </div>

      <el-tag
        class="status-pill"
        :type="tagType"
        effect="dark"
      >
        {{ store.status.statusText }}
      </el-tag>
    </div>

    <div class="connect-grid">
      <div class="input-wrap">
        <label class="field-label">直播间号</label>
        <el-input
          :model-value="store.config.roomId"
          class="room-input"
          placeholder="输入房间号或短号"
          size="large"
          @update:model-value="onRoomIdChange"
          @keyup.enter="store.connect()"
        >
          <template #prefix>
            <el-icon><VideoPlay /></el-icon>
          </template>
        </el-input>
      </div>

      <div class="input-wrap narrow">
        <label class="field-label">重连间隔</label>
        <el-input-number
          :model-value="store.config.reconnectInterval"
          :min="3"
          :max="30"
          :step="1"
          controls-position="right"
          class="number-field"
          @change="onReconnectIntervalChange"
        />
      </div>

      <div class="action-wrap">
        <el-button
          type="primary"
          size="large"
          :loading="store.connecting"
          :disabled="!store.canConnect"
          @click="store.connect()"
        >
          连接直播间
        </el-button>
        <el-button
          size="large"
          plain
          @click="store.disconnect()"
        >
          断开连接
        </el-button>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-card">
        <span>输入房间号</span>
        <strong>{{ store.status.roomId || '--' }}</strong>
      </div>
      <div class="meta-card">
        <span>真实房间号</span>
        <strong>{{ store.status.resolvedRoomId ?? '--' }}</strong>
      </div>
      <div class="meta-card">
        <span>重连次数</span>
        <strong>{{ store.status.reconnectCount }}</strong>
      </div>
    </div>

    <div
      v-if="store.status.lastError"
      class="error-banner"
    >
      {{ store.status.lastError }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { VideoPlay } from '@element-plus/icons-vue'

import { useDanmuStore } from '../stores/danmu'

const store = useDanmuStore()

const tagType = computed(() => {
  switch (store.status.status) {
    case 'connected':
      return 'success'
    case 'reconnecting':
    case 'connecting':
      return 'warning'
    case 'error':
      return 'danger'
    default:
      return 'info'
  }
})

function onRoomIdChange(value: string): void {
  void store.updateConfig({ roomId: value })
}

function onReconnectIntervalChange(value: number | undefined): void {
  void store.updateConfig({ reconnectInterval: Number(value ?? 5) })
}
</script>
