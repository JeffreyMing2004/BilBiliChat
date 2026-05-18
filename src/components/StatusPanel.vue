<template>
  <section class="glass-panel side-card">
    <div class="card-title-row">
      <h2>状态总览</h2>
      <el-tag
        :type="statusType"
        effect="dark"
      >
        {{ status.statusText }}
      </el-tag>
    </div>

    <div class="stats-grid">
      <div class="stat-item">
        <span>解析房间号</span>
        <strong>{{ status.resolvedRoomId ?? '--' }}</strong>
      </div>
      <div class="stat-item">
        <span>主播</span>
        <strong>{{ status.anchorName }}</strong>
      </div>
      <div class="stat-item">
        <span>在线热度</span>
        <strong>{{ status.popularity.toLocaleString('zh-CN') }}</strong>
      </div>
      <div class="stat-item">
        <span>当前节点</span>
        <strong>{{ status.currentHost }}</strong>
      </div>
    </div>

    <div class="room-meta">
      <span class="meta-label">房间标题</span>
      <p>{{ status.title }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { StatusSnapshot } from '../types/danmu'

const props = defineProps<{
  status: StatusSnapshot
}>()

const statusType = computed(() => {
  switch (props.status.status) {
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
</script>
