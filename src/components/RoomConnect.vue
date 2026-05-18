<template>
  <section
    v-if="room"
    class="control-panel glass-panel"
  >
    <div class="panel-toolbar">
      <div class="title-wrap">
        <p class="eyebrow">
          LiveDanmu
        </p>
        <h1>专业 OBS 弹幕控制台</h1>
      </div>

      <div class="toolbar-actions">
        <el-tag
          class="status-pill"
          :type="tagType"
          effect="dark"
        >
          {{ room.statusText }}
        </el-tag>
        <el-button
          plain
          @click="settingsStore.toggleObsMode()"
        >
          {{ settingsStore.settings.obsMode ? '退出 OBS' : 'OBS 模式' }}
        </el-button>
        <el-button
          @click="settingsStore.setSettingsVisible(true)"
        >
          设置
        </el-button>
      </div>
    </div>

    <div class="connect-grid">
      <div class="input-wrap grow">
        <label class="field-label">直播间号</label>
        <el-input
          :model-value="room.roomIdInput"
          class="room-input"
          placeholder="输入直播间号或短号"
          size="large"
          @update:model-value="onRoomIdChange"
          @keyup.enter="store.connectRoom(room.id)"
        >
          <template #prefix>
            <el-icon><VideoPlay /></el-icon>
          </template>
        </el-input>
      </div>

      <div class="action-wrap">
        <el-button
          type="primary"
          size="large"
          :loading="room.connecting"
          :disabled="!store.canConnectActive"
          @click="store.connectRoom(room.id)"
        >
          连接
        </el-button>
        <el-button
          size="large"
          plain
          @click="store.reconnectActiveRoom()"
        >
          重连
        </el-button>
        <el-button
          size="large"
          plain
          @click="store.disconnectRoom(room.id)"
        >
          断开
        </el-button>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-card">
        <span>输入房间号</span>
        <strong>{{ room.roomIdInput || '--' }}</strong>
      </div>
      <div class="meta-card">
        <span>真实房间号</span>
        <strong>{{ room.resolvedRoomId ?? '--' }}</strong>
      </div>
      <div class="meta-card">
        <span>在线人数</span>
        <strong>{{ room.popularity.toLocaleString('zh-CN') }}</strong>
      </div>
      <div class="meta-card">
        <span>消息总数</span>
        <strong>{{ room.messageCount }}</strong>
      </div>
    </div>

    <div
      v-if="room.lastError"
      class="error-banner"
    >
      {{ room.lastError }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { VideoPlay } from '@element-plus/icons-vue'

import { useDanmuStore } from '../stores/danmu'
import { useSettingsStore } from '../stores/settings'

const store = useDanmuStore()
const settingsStore = useSettingsStore()

const room = computed(() => store.activeRoom)
const tagType = computed(() => {
  switch (room.value?.status) {
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
  if (!room.value) {
    return
  }

  store.updateRoomInput(room.value.id, value)
}
</script>
