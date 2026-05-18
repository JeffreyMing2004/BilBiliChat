<template>
  <article
    class="message-card gift-card"
    :class="[
      `message-card--${variant}`,
      { 'message-card--openlive': message.provider === 'open-live' },
    ]"
  >
    <div class="message-head">
      <div class="message-meta">
        <span class="message-time">{{ message.timestamp }}</span>
        <span class="message-name gift-name">{{ message.username }}</span>
      </div>
      <el-tag
        size="small"
        type="warning"
        effect="dark"
      >
        {{ message.giftType }}
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
    <p class="message-content gift-content">
      赠送了 <strong>{{ message.giftName }}</strong> × {{ message.giftCount }}
    </p>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { resolveOpenLiveMessageTags, resolveOpenLiveMessageVariant } from '../modules/openlive'
import type { GiftMessage } from '../types/message'

const props = defineProps<{
  message: GiftMessage
}>()

const metaTags = computed(() => resolveOpenLiveMessageTags(props.message))
const variant = computed(() => resolveOpenLiveMessageVariant(props.message))
</script>
