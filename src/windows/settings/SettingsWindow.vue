<template>
  <div class="window-shell settings-shell">
    <SettingsPanel
      title="设置窗口"
      description="独立管理弹幕 Overlay、过滤器、音效和窗口偏好。"
    >
      <template #actions>
        <el-button
          plain
          @click="closeWindow"
        >
          关闭
        </el-button>
      </template>
    </SettingsPanel>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import SettingsPanel from '../../components/SettingsPanel.vue'
import { useDanmuStore } from '../../stores/danmu'
import { useSettingsStore } from '../../stores/settings'
import { closeCurrentWindow } from '../shared/manager'

const store = useDanmuStore()
const settingsStore = useSettingsStore()

async function closeWindow(): Promise<void> {
  await closeCurrentWindow()
}

onMounted(async () => {
  settingsStore.initialize()
  await store.initialize()
})
</script>
