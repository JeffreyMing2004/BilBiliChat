<template>
  <article
    class="message-card system-card"
    :class="[
      `message-card--${variant}`,
      { 'message-card--openlive': message.provider === 'open-live' },
    ]"
    :data-tone="message.tone"
  >
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
    <div class="system-row">
      <span class="message-time">{{ message.timestamp }}</span>
      <p>{{ message.content }}</p>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { resolveOpenLiveMessageTags, resolveOpenLiveMessageVariant } from '../modules/openlive'
import type { SystemMessage } from '../types/message'

const props = defineProps<{
  message: SystemMessage
}>()

const metaTags = computed(() => resolveOpenLiveMessageTags(props.message))
const variant = computed(() => resolveOpenLiveMessageVariant(props.message))
</script>
