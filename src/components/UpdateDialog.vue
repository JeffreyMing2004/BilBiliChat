<template>
  <el-dialog
    v-model="updaterState.dialogVisible"
    title="发现新版本"
    width="680px"
    destroy-on-close
    align-center
  >
    <div class="update-dialog">
      <div class="update-summary-grid">
        <div class="info-cell">
          <span>当前版本</span>
          <strong>{{ updaterState.currentVersion }}</strong>
        </div>
        <div class="info-cell">
          <span>可用版本</span>
          <strong>{{ updaterState.availableVersion || '--' }}</strong>
        </div>
        <div class="info-cell">
          <span>更新渠道</span>
          <strong>{{ channelLabel }}</strong>
        </div>
        <div class="info-cell">
          <span>发布时间</span>
          <strong>{{ publishedLabel }}</strong>
        </div>
      </div>

      <div
        v-if="updaterState.lastError"
        class="error-banner"
      >
        {{ updaterState.lastError }}
      </div>

      <div class="update-notes-panel">
        <div class="dashboard-card-head">
          <div>
            <p class="eyebrow">
              Update Notes
            </p>
            <h3>更新日志</h3>
          </div>
          <span
            v-if="updaterState.downloading || updaterState.installing"
            class="update-progress"
          >
            {{ updaterState.progress }}%
          </span>
        </div>
        <pre>{{ notes }}</pre>
      </div>
    </div>

    <template #footer>
      <div class="update-dialog-actions">
        <el-button @click="dismissLater">
          稍后提醒
        </el-button>
        <el-button
          plain
          :loading="updaterState.downloading"
          :disabled="!updaterState.availableVersion || updaterState.downloaded"
          @click="downloadUpdate"
        >
          后台下载
        </el-button>
        <el-button
          plain
          :disabled="!updaterState.downloaded"
          @click="installDownloaded"
        >
          安装已下载更新
        </el-button>
        <el-button
          type="primary"
          :loading="updaterState.installing"
          :disabled="!updaterState.availableVersion"
          @click="downloadAndInstall"
        >
          立即更新
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'

import {
  dismissAvailableUpdate,
  downloadAndInstallUpdate,
  downloadUpdatePackage,
  getUpdateNotes,
  installDownloadedUpdate,
  updaterState,
} from '../modules/updater'

const channelLabel = computed(() => {
  if (updaterState.channel === 'beta') {
    return 'Beta'
  }

  if (updaterState.channel === 'nightly') {
    return 'Nightly'
  }

  return 'Stable'
})

const publishedLabel = computed(() => (
  updaterState.publishedAt
    ? new Date(updaterState.publishedAt).toLocaleString('zh-CN', { hour12: false })
    : '未提供'
))

const notes = computed(() => getUpdateNotes())

function dismissLater(): void {
  dismissAvailableUpdate()
}

async function downloadAndInstall(): Promise<void> {
  const completed = await downloadAndInstallUpdate()
  if (!completed && updaterState.lastError) {
    ElMessage.error(updaterState.lastError)
  }
}

async function downloadUpdate(): Promise<void> {
  const completed = await downloadUpdatePackage()
  if (completed) {
    ElMessage.success('更新包已下载完成，可稍后安装')
  } else if (updaterState.lastError) {
    ElMessage.error(updaterState.lastError)
  }
}

async function installDownloaded(): Promise<void> {
  const completed = await installDownloadedUpdate()
  if (!completed && updaterState.lastError) {
    ElMessage.error(updaterState.lastError)
  }
}
</script>

<style scoped>
.update-dialog {
  display: grid;
  gap: 16px;
}

.update-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.update-notes-panel {
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.update-notes-panel pre {
  margin: 12px 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.65;
  color: var(--text-secondary);
}

.update-progress {
  color: var(--accent-primary);
  font-weight: 700;
}

.update-dialog-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
</style>
