<template>
  <header class="app-header glass-panel">
    <div>
      <p class="eyebrow">
        LiveDanmu
      </p>
      <h1>哔哩哔哩直播弹幕查看工具</h1>
    </div>

    <el-button
      class="header-button"
      type="primary"
      plain
      @click="emit('openSettings')"
    >
      <el-icon><Setting /></el-icon>
      设置
    </el-button>
  </header>
</template>

<script setup lang="ts">
import { Setting } from '@element-plus/icons-vue'

const emit = defineEmits<{
  openSettings: []
}>()
</script>
