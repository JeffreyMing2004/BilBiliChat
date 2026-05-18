<template>
  <div class="window-shell login-shell">
    <section class="login-panel glass-panel">
      <div data-tauri-drag-region>
        <p class="eyebrow">
          Login Window
        </p>
        <h1>{{ authStore.feature.title }}</h1>
        <p class="window-subtitle">
          {{ authStore.feature.description }}
        </p>
      </div>

      <div class="info-grid">
        <div class="info-cell">
          <span>Provider</span>
          <strong>{{ authStore.feature.provider }}</strong>
        </div>
        <div class="info-cell">
          <span>OAuth 状态</span>
          <strong>{{ authStore.feature.oauthReady ? '已接入' : '待配置' }}</strong>
        </div>
        <div class="info-cell">
          <span>登录状态</span>
          <strong>{{ statusText }}</strong>
        </div>
        <div class="info-cell">
          <span>UID</span>
          <strong>{{ authStore.user?.uid || '--' }}</strong>
        </div>
      </div>

      <div
        v-if="authStore.user"
        class="login-user-card"
      >
        <img
          v-if="authStore.user.avatar"
          :src="authStore.user.avatar"
          :alt="authStore.user.nickname"
          class="login-user-avatar"
        >
        <div>
          <strong>{{ authStore.user.nickname }}</strong>
          <p>Lv.{{ authStore.user.level }} · 粉丝 {{ formatCount(authStore.user.fansCount) }}</p>
          <p>{{ authStore.user.sign || '这个用户还没有留下个性签名。' }}</p>
        </div>
      </div>

      <p
        v-if="authStore.lastError"
        class="login-error"
      >
        {{ authStore.lastError }}
      </p>

      <div class="login-actions">
        <el-button
          type="primary"
          :disabled="!authStore.feature.oauthReady || authStore.status === 'authorizing'"
          @click="authStore.startLogin()"
        >
          {{ authStore.isLoggedIn ? '重新授权' : '打开 OAuth 登录' }}
        </el-button>
        <el-button
          plain
          :disabled="!authStore.isLoggedIn"
          @click="authStore.refreshUser()"
        >
          刷新用户信息
        </el-button>
        <el-button
          plain
          :disabled="!authStore.isLoggedIn"
          @click="authStore.logout()"
        >
          退出登录
        </el-button>
        <el-button
          plain
          @click="closeWindow"
        >
          关闭窗口
        </el-button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

import { logError } from '../../core/logger/Logger'
import { useAuthStore } from '../../stores/auth'
import { closeCurrentWindow } from '../shared/manager'

const authStore = useAuthStore()

const statusText = computed(() => {
  switch (authStore.status) {
    case 'authorizing':
      return '授权中'
    case 'authenticated':
      return '已登录'
    case 'refreshing':
      return '同步中'
    case 'error':
      return '异常'
    default:
      return '未登录'
  }
})

function formatCount(value: number): string {
  return value.toLocaleString('zh-CN')
}

async function closeWindow(): Promise<void> {
  try {
    await closeCurrentWindow()
  } catch (error) {
    const message = error instanceof Error ? error.message : '关闭登录窗口失败'
    logError('windows', message)
    ElMessage.error(message)
  }
}

onMounted(async () => {
  await authStore.initialize()
})
</script>
