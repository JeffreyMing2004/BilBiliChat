<template>
  <section class="danmu-panel glass-panel">
    <div class="panel-head">
      <div>
        <h2>实时互动流</h2>
        <p>普通弹幕、礼物、SC 与系统消息统一展示</p>
      </div>

      <div class="panel-actions">
        <el-tag
          v-if="store.isAutoScrollPaused"
          type="warning"
          effect="dark"
        >
          已暂停自动滚动
        </el-tag>
        <el-button
          size="small"
          @click="store.clearMessages()"
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
        v-if="store.messages.length === 0"
        class="empty-state"
      >
        连接直播间后，这里会实时显示弹幕、礼物、SC 和系统互动消息。
      </div>

      <transition-group
        name="message-fade"
        tag="div"
        class="danmu-items"
      >
        <template
          v-for="message in store.messages"
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
      </transition-group>
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
import { nextTick, ref, watch } from 'vue'

import { useDanmuStore } from '../stores/danmu'
import DanmuItem from './DanmuItem.vue'
import GiftItem from './GiftItem.vue'
import SCItem from './SCItem.vue'
import SystemMessage from './SystemMessage.vue'

const store = useDanmuStore()
const listRef = ref<HTMLElement | null>(null)

function scrollToBottom(force = false): void {
  const element = listRef.value

  if (!element) {
    return
  }

  const distance = element.scrollHeight - element.scrollTop - element.clientHeight

  if (force || store.status.autoScrollEnabled || distance < 48) {
    element.scrollTo({
      top: element.scrollHeight,
      behavior: force ? 'smooth' : 'auto',
    })
  }
}

function handleScroll(): void {
  const element = listRef.value

  if (!element) {
    return
  }

  const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 40
  store.setAutoScrollEnabled(nearBottom)
}

function resumeAutoScroll(): void {
  store.setAutoScrollEnabled(true)
  scrollToBottom(true)
}

watch(
  () => store.messages.length,
  async () => {
    await nextTick()
    scrollToBottom()
  },
)
</script>
