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
import { ElMessage } from 'element-plus'
import { getVersion } from '@tauri-apps/api/app'

import { logError } from '../../core/logger/Logger'
import SettingsPanel from '../../components/SettingsPanel.vue'
import { initializeUpdater } from '../../modules/updater'
import { useAuthStore } from '../../stores/auth'
import { useDanmuStore } from '../../stores/danmu'
import { useSettingsStore } from '../../stores/settings'
import { closeCurrentWindow } from '../shared/manager'

const authStore = useAuthStore()
const store = useDanmuStore()
const settingsStore = useSettingsStore()

async function closeWindow(): Promise<void> {
  try {
    await closeCurrentWindow()
  } catch (error) {
    const message = error instanceof Error ? error.message : '关闭设置窗口失败'
    logError('windows', message)
    ElMessage.error(message)
  }
}

onMounted(async () => {
  settingsStore.initialize()
  await authStore.initialize()
  await store.initialize()
  await initializeUpdater(await getVersion())
})
</script>
