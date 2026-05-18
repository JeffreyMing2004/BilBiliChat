<template>
  <div class="window-shell crash-shell">
    <section class="crash-panel glass-panel">
      <div class="dashboard-card-head">
        <div>
          <p class="eyebrow">
            Crash Window
          </p>
          <h2>崩溃报告中心</h2>
          <p class="crash-subtitle">
            集中查看 Overlay、WebSocket、窗口和运行时异常，方便现场定位与恢复。
          </p>
        </div>
        <div class="crash-actions">
          <el-button
            plain
            :disabled="!reports.length"
            @click="copyLatest"
          >
            复制最新报告
          </el-button>
          <el-button
            plain
            :disabled="!reports.length"
            @click="exportJson"
          >
            导出 JSON
          </el-button>
          <el-button
            plain
            :disabled="!reports.length"
            @click="exportText"
          >
            导出文本
          </el-button>
          <el-button
            plain
            :disabled="!reports.length"
            @click="clearReports"
          >
            清空报告
          </el-button>
          <el-button
            plain
            @click="closeWindow"
          >
            关闭窗口
          </el-button>
        </div>
      </div>

      <div class="crash-summary-grid">
        <div class="info-cell">
          <span>报告总数</span>
          <strong>{{ reports.length }}</strong>
        </div>
        <div class="info-cell">
          <span>致命异常</span>
          <strong>{{ fatalCount }}</strong>
        </div>
        <div class="info-cell">
          <span>最新来源</span>
          <strong>{{ latestReport?.source || '--' }}</strong>
        </div>
        <div class="info-cell">
          <span>最新窗口</span>
          <strong>{{ latestReport?.windowLabel || '--' }}</strong>
        </div>
      </div>

      <div
        v-if="!reports.length"
        class="empty-state"
      >
        <div>
          <h3>当前没有崩溃报告</h3>
          <p>运行时异常、窗口异常和 Overlay 渲染异常会自动出现在这里。</p>
        </div>
      </div>

      <div
        v-else
        class="crash-report-list"
      >
        <article
          v-for="report in reports"
          :key="report.id"
          class="crash-report-card"
          :class="{ 'is-fatal': report.fatal }"
        >
          <div class="crash-report-head">
            <div class="crash-report-title">
              <el-tag
                size="small"
                :type="report.fatal ? 'danger' : 'warning'"
              >
                {{ report.fatal ? 'Fatal' : 'Recoverable' }}
              </el-tag>
              <strong>{{ report.source }}</strong>
            </div>
            <span>{{ formatDate(report.occurredAt) }}</span>
          </div>

          <div class="crash-report-meta">
            <span>域：{{ report.domain }}</span>
            <span>窗口：{{ report.windowLabel }}</span>
          </div>

          <p class="crash-message">
            {{ report.message }}
          </p>

          <details
            v-if="report.stack || Object.keys(report.metadata).length"
            class="crash-details"
          >
            <summary>查看详情</summary>
            <pre
              v-if="report.stack"
              class="crash-block"
            >{{ report.stack }}</pre>
            <pre
              v-if="Object.keys(report.metadata).length"
              class="crash-block"
            >{{ formatMetadata(report.metadata) }}</pre>
          </details>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'

import type { CrashReport } from '../../core/crash/CrashReporter'
import { crashReporter } from '../../core/crash/CrashReporter'
import { logError } from '../../core/logger/Logger'
import { initializeWindowState } from '../../window'
import { closeCurrentWindow } from '../shared/manager'

const reports = ref<CrashReport[]>(crashReporter.getReports())
const cleanups: Array<() => void> = []

const latestReport = computed(() => reports.value[0] ?? null)
const fatalCount = computed(() => reports.value.filter((report) => report.fatal).length)

function formatDate(value: number): string {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  })
}

function formatMetadata(metadata: Record<string, unknown>): string {
  return JSON.stringify(metadata, null, 2)
}

async function copyLatest(): Promise<void> {
  if (!latestReport.value) {
    return
  }

  const payload = JSON.stringify(latestReport.value, null, 2)
  await navigator.clipboard.writeText(payload)
  ElMessage.success('最新崩溃报告已复制到剪贴板')
}

function clearReports(): void {
  crashReporter.clear()
  ElMessage.success('崩溃报告已清空')
}

function exportJson(): void {
  crashReporter.downloadReports('json')
  ElMessage.success('Crash Report JSON 已导出')
}

function exportText(): void {
  crashReporter.downloadReports('txt')
  ElMessage.success('Crash Report 文本已导出')
}

async function closeWindow(): Promise<void> {
  try {
    await closeCurrentWindow()
  } catch (error) {
    const message = error instanceof Error ? error.message : '关闭崩溃报告窗口失败'
    logError('windows', message)
    ElMessage.error(message)
  }
}

onMounted(async () => {
  cleanups.push(await initializeWindowState())
  cleanups.push(crashReporter.subscribe((nextReports) => {
    reports.value = nextReports
  }))
})

onBeforeUnmount(() => {
  cleanups.forEach((cleanup) => cleanup())
})
</script>

<style scoped>
.crash-shell {
  padding: 20px;
}

.crash-panel {
  height: calc(100vh - 40px);
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.crash-subtitle {
  margin: 6px 0 0;
  color: var(--text-secondary);
}

.crash-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.crash-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.crash-report-list {
  min-height: 0;
  overflow: auto;
  display: grid;
  gap: 12px;
  padding-right: 4px;
}

.crash-report-card {
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  padding: 16px;
}

.crash-report-card.is-fatal {
  border-color: rgba(245, 108, 108, 0.42);
  background: rgba(245, 108, 108, 0.08);
}

.crash-report-head,
.crash-report-title,
.crash-report-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.crash-report-head {
  justify-content: space-between;
}

.crash-report-meta {
  margin-top: 10px;
  color: var(--text-secondary);
  font-size: 12px;
  flex-wrap: wrap;
}

.crash-message {
  margin: 12px 0 0;
  line-height: 1.6;
}

.crash-details {
  margin-top: 12px;
}

.crash-block {
  margin: 10px 0 0;
  padding: 12px;
  border-radius: 12px;
  background: rgba(6, 10, 18, 0.74);
  color: #d9e7ff;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
