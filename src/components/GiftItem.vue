<template>
  <article class="message-card gift-card">
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
    <p class="message-content gift-content">
      赠送了 <strong>{{ message.giftName }}</strong> × {{ message.giftCount }}
    </p>
  </article>
</template>

<script setup lang="ts">
import type { GiftMessage } from '../types/message'

defineProps<{
  message: GiftMessage
}>()
</script>
