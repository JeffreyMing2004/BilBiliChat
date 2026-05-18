<template>
  <article
    class="message-card system-card"
    :data-tone="message.tone"
  >
    <div class="system-row">
      <span class="message-time">{{ message.timestamp }}</span>
      <p>{{ message.content }}</p>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { SystemMessage } from '../types/message'

defineProps<{
  message: SystemMessage
}>()
</script>
