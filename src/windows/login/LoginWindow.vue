<template>
  <div class="window-shell login-shell">
    <section class="login-panel glass-panel">
      <p class="eyebrow">
        Login Window
      </p>
      <h1>{{ feature.title }}</h1>
      <p class="window-subtitle">
        {{ feature.description }}
      </p>

      <div class="info-grid">
        <div class="info-cell">
          <span>Provider</span>
          <strong>{{ feature.provider }}</strong>
        </div>
        <div class="info-cell">
          <span>OAuth 状态</span>
          <strong>{{ feature.oauthReady ? '已接入' : '预留中' }}</strong>
        </div>
      </div>

      <div class="login-actions">
        <el-button
          type="primary"
          disabled
        >
          OAuth 登录预留
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
import { getLoginFeatureStatus } from '../../modules/login'
import { closeCurrentWindow } from '../shared/manager'

const feature = getLoginFeatureStatus()

async function closeWindow(): Promise<void> {
  await closeCurrentWindow()
}
</script>
