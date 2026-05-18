<template>
  <section class="glass-panel side-card">
    <div class="card-title-row">
      <h2>运行日志</h2>
      <el-tag effect="plain">
        最近 6 条
      </el-tag>
    </div>

    <div class="log-list">
      <div
        v-for="log in visibleLogs"
        :key="log.id"
        class="log-item"
      >
        <span class="log-time">{{ log.time }}</span>
        <el-tag
          size="small"
          effect="dark"
          :type="tagType(log.level)"
        >
          {{ log.level }}
        </el-tag>
        <p>{{ log.message }}</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { LogLevel } from '../utils/logger'
import { useDanmuStore } from '../stores/danmu'

const store = useDanmuStore()

const visibleLogs = computed(() => store.logs.slice(0, 6))

function tagType(level: LogLevel): 'info' | 'success' | 'warning' | 'danger' {
  switch (level) {
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'error':
      return 'danger'
    default:
      return 'info'
  }
}
</script>
