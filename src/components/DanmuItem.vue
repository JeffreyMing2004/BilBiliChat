<template>
  <article class="message-card danmu-card">
    <div class="message-head">
      <div class="message-meta">
        <span class="message-time">{{ message.timestamp }}</span>
        <span
          class="message-name"
          :style="{ color: message.userColor }"
        >{{ message.username }}</span>
      </div>
      <el-tag
        size="small"
        effect="plain"
      >
        弹幕
      </el-tag>
    </div>
    <p class="message-content">
      {{ message.content }}
    </p>
  </article>
</template>

<script setup lang="ts">
import type { DanmuMessage } from '../types/message'

defineProps<{
  message: DanmuMessage
}>()
</script>
