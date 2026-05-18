<template>
  <section class="glass-panel side-card">
    <div class="card-title-row">
      <h2>直播间连接</h2>
      <el-tag effect="plain">
        WebSocket
      </el-tag>
    </div>

    <el-form
      label-position="top"
      class="connection-form"
    >
      <el-form-item label="直播间号">
        <el-input
          :model-value="store.config.roomId"
          placeholder="输入房间号或短号"
          size="large"
          @update:model-value="onRoomIdChange"
        >
          <template #prefix>
            <el-icon><VideoPlay /></el-icon>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item label="自动重连间隔（秒）">
        <el-input-number
          :model-value="store.config.reconnectInterval"
          :min="3"
          :max="30"
          :step="1"
          controls-position="right"
          class="full-width"
          @change="onReconnectChange"
        />
      </el-form-item>

      <el-form-item>
        <el-switch
          :model-value="store.config.autoConnect"
          inline-prompt
          active-text="自动连接"
          inactive-text="手动连接"
          @change="onAutoConnectChange"
        />
      </el-form-item>
    </el-form>

    <div class="connection-actions">
      <el-button
        type="primary"
        size="large"
        :disabled="!canConnect"
        @click="store.connect()"
      >
        <el-icon><Link /></el-icon>
        连接直播间
      </el-button>
      <el-button
        size="large"
        @click="store.disconnect()"
      >
        <el-icon><SwitchButton /></el-icon>
        断开连接
      </el-button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Link, SwitchButton, VideoPlay } from '@element-plus/icons-vue'

import { useDanmuStore } from '../stores/danmu'

const store = useDanmuStore()

const canConnect = computed(() => Boolean(store.config.roomId.trim()) && !store.groupedStatus.isBusy)

function onRoomIdChange(value: string): void {
  void store.updateConfig({ roomId: value })
}

function onReconnectChange(value: number | undefined): void {
  void store.updateConfig({ reconnectInterval: Number(value ?? 5) })
}

function onAutoConnectChange(value: string | number | boolean): void {
  void store.updateConfig({ autoConnect: Boolean(value) })
}
</script>
