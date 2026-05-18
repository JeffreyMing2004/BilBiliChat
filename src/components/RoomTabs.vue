<template>
  <section class="tabs-panel glass-panel">
    <div class="tabs-list">
      <button
        v-for="room in store.roomList"
        :key="room.id"
        class="room-tab"
        :class="{ 'is-active': room.id === store.activeRoomId }"
        type="button"
        @click="store.setActiveRoom(room.id)"
      >
        <span
          class="room-dot"
          :data-status="room.status"
        />
        <span class="room-label">{{ roomLabel(room.roomIdInput, room.resolvedRoomId) }}</span>
        <span
          class="tab-close"
          @click.stop="store.removeRoom(room.id)"
        >
          ×
        </span>
      </button>
    </div>

    <el-button
      circle
      type="primary"
      @click="store.addRoom()"
    >
      <el-icon><Plus /></el-icon>
    </el-button>
  </section>
</template>

<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'

import { useDanmuStore } from '../stores/danmu'

const store = useDanmuStore()

function roomLabel(inputRoomId: string, resolvedRoomId: number | null): string {
  return inputRoomId || (resolvedRoomId ? String(resolvedRoomId) : '未命名房间')
}
</script>
