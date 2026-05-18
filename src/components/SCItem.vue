<template>
  <article
    class="message-card sc-card"
    :class="[
      `message-card--${variant}`,
      { 'message-card--openlive': message.provider === 'open-live' },
    ]"
    :style="{ '--sc-accent': message.priceColor }"
  >
    <div class="sc-banner">
      <div>
        <span class="message-time">{{ message.timestamp }}</span>
        <strong class="sc-name">{{ message.username }}</strong>
      </div>
      <span class="sc-price">￥{{ message.price }}</span>
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
    <p class="message-content sc-content">
      {{ message.content }}
    </p>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { resolveOpenLiveMessageTags, resolveOpenLiveMessageVariant } from '../modules/openlive'
import type { SCMessage } from '../types/message'

const props = defineProps<{
  message: SCMessage
}>()

const metaTags = computed(() => resolveOpenLiveMessageTags(props.message))
const variant = computed(() => resolveOpenLiveMessageVariant(props.message))
</script>
