<template>
  <article
    class="message-card sc-card"
    :style="{ '--sc-accent': message.priceColor }"
  >
    <div class="sc-banner">
      <div>
        <span class="message-time">{{ message.timestamp }}</span>
        <strong class="sc-name">{{ message.username }}</strong>
      </div>
      <span class="sc-price">￥{{ message.price }}</span>
    </div>
    <p class="message-content sc-content">
      {{ message.content }}
    </p>
  </article>
</template>

<script setup lang="ts">
import type { SCMessage } from '../types/message'

defineProps<{
  message: SCMessage
}>()
</script>
