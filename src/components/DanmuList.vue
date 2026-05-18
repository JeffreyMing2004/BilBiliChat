<template>
  <section class="panel danmu-panel">
    <div class="panel-head">
      <div>
        <h2>实时弹幕</h2>
        <p>收到 {{ store.messages.length }} 条消息</p>
      </div>

      <el-button
        size="small"
        @click="store.clearMessages()"
      >
        清空
      </el-button>
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
        点击连接后，这里会实时显示弹幕、礼物、SC 和进入直播间事件。
      </div>

      <transition-group
        name="danmu-slide"
        tag="div"
        class="danmu-items"
      >
        <article
          v-for="item in store.messages"
          :key="item.id"
          class="danmu-item"
          :data-type="item.type"
        >
          <div class="danmu-item-head">
            <span class="danmu-time">{{ item.timestamp }}</span>
            <el-tag
              size="small"
              effect="plain"
            >
              {{ item.rawCommand }}
            </el-tag>
          </div>
          <pre class="danmu-text">{{ item.summary }}</pre>
        </article>
      </transition-group>
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import { useDanmuStore } from '../stores/danmu'

const store = useDanmuStore()
const listRef = ref<HTMLElement | null>(null)
const shouldStickBottom = ref(true)

function scrollToBottom(force = false): void {
  const element = listRef.value

  if (!element) {
    return
  }

  const distance = element.scrollHeight - element.scrollTop - element.clientHeight

  if (force || shouldStickBottom.value || distance < 50) {
    element.scrollTo({
      top: element.scrollHeight,
      behavior: 'smooth',
    })
  }
}

function handleScroll(): void {
  const element = listRef.value

  if (!element) {
    return
  }

  shouldStickBottom.value = element.scrollHeight - element.scrollTop - element.clientHeight < 40
}

watch(
  () => store.messages.length,
  async () => {
    await nextTick()
    scrollToBottom()
  },
)
</script>
