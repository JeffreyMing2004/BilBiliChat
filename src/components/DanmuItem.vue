<template>
  <article
    class="message-card danmu-card"
    :class="[
      `message-card--${variant}`,
      { 'message-card--openlive': message.provider === 'open-live' },
    ]"
  >
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
    <div
      v-if="metaTags.length"
      class="message-tags"
    >
      <span
        v-for="tag in metaTags"
        :key="tag"
        class="message-chip"
      >{{ tag }}</span>
    </div>
    <p class="message-content">
      {{ message.content }}
    </p>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { resolveOpenLiveMessageTags, resolveOpenLiveMessageVariant } from '../modules/openlive'
import type { DanmuMessage } from '../types/message'

const props = defineProps<{
  message: DanmuMessage
}>()

const metaTags = computed(() => resolveOpenLiveMessageTags(props.message))
const variant = computed(() => resolveOpenLiveMessageVariant(props.message))
</script>
