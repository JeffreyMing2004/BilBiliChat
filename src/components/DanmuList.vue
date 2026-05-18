<template>
  <section class="danmu-panel glass-panel">
    <div class="panel-head">
      <div>
        <h2>{{ settingsStore.settings.obsMode ? 'OBS 弹幕 Overlay' : '实时互动流' }}</h2>
        <p>{{ headDescription }}</p>
      </div>

      <div class="panel-actions">
        <el-tag
          v-if="store.isAutoScrollPaused"
          type="warning"
          effect="dark"
        >
          已暂停自动滚动
        </el-tag>
        <el-tag
          v-if="settingsStore.keywordFilters.length || settingsStore.userBlacklist.length"
          effect="plain"
        >
          过滤已启用
        </el-tag>
        <el-button
          size="small"
          @click="store.clearActiveMessages()"
        >
          清空
        </el-button>
      </div>
    </div>

    <div
      ref="listRef"
      class="danmu-list"
      @scroll="handleScroll"
    >
      <div
        v-if="filteredMessages.length === 0"
        class="empty-state"
      >
        连接直播间后，这里会实时显示弹幕、礼物、SC 和系统互动消息。
      </div>

      <div
        v-else
        class="virtual-list"
      >
        <div :style="{ height: `${topSpacerHeight}px` }" />
        <div class="danmu-items">
          <template
            v-for="message in visibleMessages"
            :key="message.id"
          >
            <GiftItem
              v-if="message.type === 'gift'"
              :message="message"
            />
            <SCItem
              v-else-if="message.type === 'superChat'"
              :message="message"
            />
            <SystemMessage
              v-else-if="message.type === 'system'"
              :message="message"
            />
            <DanmuItem
              v-else
              :message="message"
            />
          </template>
        </div>
        <div :style="{ height: `${bottomSpacerHeight}px` }" />
      </div>
    </div>

    <transition name="dock-fade">
      <button
        v-if="store.isAutoScrollPaused"
        class="jump-bottom"
        type="button"
        @click="resumeAutoScroll"
      >
        回到底部
      </button>
    </transition>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import { shouldFilterMessage } from '../filters'
import { useDanmuStore } from '../stores/danmu'
import { useSettingsStore } from '../stores/settings'
import DanmuItem from './DanmuItem.vue'
import GiftItem from './GiftItem.vue'
import SCItem from './SCItem.vue'
import SystemMessage from './SystemMessage.vue'

const store = useDanmuStore()
const settingsStore = useSettingsStore()
const listRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(600)

const filteredMessages = computed(() => {
  const messages = store.activeRoom?.messages ?? []
  const visibleMessages = messages.filter((message) => !shouldFilterMessage(
    message,
    settingsStore.settings,
    settingsStore.keywordFilters,
    settingsStore.userBlacklist,
  ))

  return settingsStore.settings.direction === 'top-down'
    ? [...visibleMessages].reverse()
    : visibleMessages
})

const headDescription = computed(() => (
  settingsStore.settings.obsMode
    ? '透明窗口下仅保留高可读弹幕，适合 OBS 采集'
    : `当前展示 ${filteredMessages.value.length} 条消息，虚拟列表已启用`
))

const estimatedItemHeight = computed(() => (
  settingsStore.settings.obsMode
    ? Math.max(92, settingsStore.settings.fontSize * 2.6)
    : 108
))

const overscan = 10
const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / estimatedItemHeight.value) - overscan))
const endIndex = computed(() => Math.min(
  filteredMessages.value.length,
  startIndex.value + Math.ceil(viewportHeight.value / estimatedItemHeight.value) + overscan * 2,
))
const visibleMessages = computed(() => filteredMessages.value.slice(startIndex.value, endIndex.value))
const topSpacerHeight = computed(() => startIndex.value * estimatedItemHeight.value)
const bottomSpacerHeight = computed(() => Math.max(
  0,
  (filteredMessages.value.length - endIndex.value) * estimatedItemHeight.value,
))

function scrollToEdge(force = false): void {
  const element = listRef.value

  if (!element) {
    return
  }

  if (!force && !store.autoScrollEnabled) {
    return
  }

  const top = settingsStore.settings.direction === 'top-down' ? 0 : element.scrollHeight

  element.scrollTo({
    top,
    behavior: force ? 'smooth' : 'auto',
  })
}

function handleScroll(): void {
  const element = listRef.value

  if (!element) {
    return
  }

  scrollTop.value = element.scrollTop
  viewportHeight.value = element.clientHeight

  const nearTarget = settingsStore.settings.direction === 'top-down'
    ? element.scrollTop < 40
    : element.scrollHeight - element.scrollTop - element.clientHeight < 40

  store.setAutoScrollEnabled(nearTarget)
}

function resumeAutoScroll(): void {
  store.setAutoScrollEnabled(true)
  scrollToEdge(true)
}

watch(
  () => filteredMessages.value.length,
  async () => {
    await nextTick()
    scrollToEdge()
  },
)

watch(
  () => settingsStore.settings.direction,
  async () => {
    await nextTick()
    scrollToEdge(true)
  },
)

onMounted(() => {
  viewportHeight.value = listRef.value?.clientHeight ?? 600
  scrollToEdge(true)
})
</script>
