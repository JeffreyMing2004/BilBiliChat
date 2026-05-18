<template>
  <section class="glass-panel danmu-panel">
    <div class="card-title-row">
      <div>
        <h2>实时弹幕</h2>
        <p class="subtle-text">
          共 {{ store.messages.length }} 条消息
        </p>
      </div>

      <div class="danmu-actions">
        <el-button
          size="small"
          @click="scrollToBottom(true)"
        >
          <el-icon><RefreshRight /></el-icon>
          到底部
        </el-button>
        <el-button
          size="small"
          @click="store.clearMessages()"
        >
          <el-icon><Delete /></el-icon>
          清空
        </el-button>
      </div>
    </div>

    <div
      ref="listRef"
      class="danmu-list"
      @scroll="handleScroll"
    >
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
          <div class="message-meta">
            <span class="message-time">{{ item.timestamp }}</span>
            <span
              class="message-user"
              :style="{ color: item.userColor }"
            >{{ item.username }}</span>
            <el-tag
              v-if="item.type === 'gift'"
              type="warning"
              effect="dark"
            >
              礼物
            </el-tag>
            <el-tag
              v-else-if="item.type === 'entry'"
              type="info"
              effect="dark"
            >
              进入
            </el-tag>
            <el-tag
              v-else-if="item.type === 'superChat'"
              type="danger"
              effect="dark"
            >
              SC {{ item.price ?? 0 }}
            </el-tag>
            <el-tag
              v-else-if="item.type === 'system'"
              effect="plain"
            >
              系统
            </el-tag>
          </div>
          <p class="message-content">
            {{ item.content }}
          </p>
        </article>
      </transition-group>
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Delete, RefreshRight } from '@element-plus/icons-vue'

import { useDanmuStore } from '../stores/danmu'

const store = useDanmuStore()
const listRef = ref<HTMLDivElement | null>(null)
const autoScroll = ref(true)

function scrollToBottom(force = false): void {
  const element = listRef.value

  if (!element) {
    return
  }

  const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight

  if (force || autoScroll.value || distanceToBottom < 60) {
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

  autoScroll.value = element.scrollHeight - element.scrollTop - element.clientHeight < 40
}

watch(
  () => store.messages.length,
  async () => {
    await nextTick()
    scrollToBottom()
  },
)
</script>
