<template>
  <section class="panel toolbar-panel">
    <div class="toolbar-row">
      <el-input
        :model-value="store.config.roomId"
        class="room-input"
        placeholder="输入直播间号或短号"
        size="large"
        @update:model-value="onRoomIdChange"
        @keyup.enter="store.connect()"
      >
        <template #prefix>
          <el-icon><VideoPlay /></el-icon>
        </template>
      </el-input>

      <el-button
        type="primary"
        size="large"
        :loading="store.connecting"
        :disabled="!store.canConnect"
        @click="store.connect()"
      >
        连接
      </el-button>

      <el-button
        size="large"
        @click="store.disconnect()"
      >
        断开
      </el-button>

      <el-tag
        class="status-tag"
        :type="tagType"
        effect="dark"
      >
        {{ store.status.statusText }}
      </el-tag>
    </div>

    <div class="toolbar-meta">
      <span>输入房间号：{{ store.status.roomId || '--' }}</span>
      <span>真实 room_id：{{ store.status.resolvedRoomId ?? '--' }}</span>
      <span>重连间隔：{{ store.config.reconnectInterval }}s</span>
    </div>

    <div
      v-if="store.status.lastError"
      class="error-tip"
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
</script>
