<template>
  <div
    class="window-shell main-shell"
    :style="settingsStore.overlayStyleVars"
  >
    <header class="main-topbar glass-panel">
      <div>
        <p class="eyebrow">
          LiveDanmu Console
        </p>
        <h1>专业级 Bilibili 直播控制台</h1>
        <p class="window-subtitle">
          主控制台负责房间管理、状态监控和独立弹幕窗口调度。
        </p>
      </div>

      <div class="main-topbar-actions">
        <el-button
          plain
          @click="openLogin"
        >
          {{ authStore.isLoggedIn ? '账号中心' : '立即登录' }}
        </el-button>
        <el-button
          plain
          @click="openSettings"
        >
          设置窗口
        </el-button>
        <el-button
          plain
          @click="openDebug"
        >
          调试窗口
        </el-button>
        <el-button
          plain
          @click="openCrashWindow"
        >
          Crash Center
        </el-button>
        <el-button
          plain
          @click="openOverlayStudio"
        >
          Overlay Studio
        </el-button>
        <el-button
          type="primary"
          @click="openDanmuWindow"
        >
          打开弹幕窗口
        </el-button>
      </div>
    </header>

    <section class="main-layout">
      <aside class="sidebar-panel glass-panel">
        <div class="sidebar-head">
          <div>
            <p class="eyebrow">
              Rooms
            </p>
            <h2>直播间列表</h2>
          </div>
          <el-button
            circle
            type="primary"
            @click="store.addRoom()"
          >
            +
          </el-button>
        </div>

        <div class="sidebar-list">
          <article
            v-for="(room, index) in store.roomList"
            :key="room.id"
            class="room-sidebar-card"
            :class="{ 'is-active': room.id === store.activeRoomId }"
            tabindex="0"
            @click="store.setActiveRoom(room.id)"
            @keyup.enter="store.setActiveRoom(room.id)"
          >
            <div class="room-sidebar-head">
              <img
                v-if="room.streamer?.avatar"
                :src="room.streamer.avatar"
                :alt="room.streamer.name"
                class="room-avatar"
              >
              <div
                v-else
                class="room-avatar room-avatar--placeholder"
              >
                {{ (room.streamer?.name || room.roomIdInput || '?').slice(0, 1).toUpperCase() }}
              </div>

              <div class="room-sidebar-meta">
                <strong>{{ room.streamer?.name || `房间 ${room.roomIdInput || index + 1}` }}</strong>
                <span>{{ room.streamer?.title || '等待获取直播间标题' }}</span>
              </div>
            </div>

            <div class="room-sidebar-status">
              <el-tag
                size="small"
                :type="resolveStatusType(room.status)"
              >
                {{ room.statusText }}
              </el-tag>
              <span>{{ (room.popularity ?? 0).toLocaleString('zh-CN') }} 人气</span>
            </div>

            <div class="room-sidebar-actions">
              <el-button
                size="small"
                @click.stop="connectAndOpen(room.id)"
              >
                连接
              </el-button>
              <el-button
                size="small"
                plain
                @click.stop="store.disconnectRoom(room.id)"
              >
                断开
              </el-button>
              <el-button
                size="small"
                plain
                :disabled="index === 0"
                @click.stop="store.moveRoom(room.id, -1)"
              >
                上移
              </el-button>
              <el-button
                size="small"
                plain
                :disabled="index === store.roomList.length - 1"
                @click.stop="store.moveRoom(room.id, 1)"
              >
                下移
              </el-button>
              <el-button
                size="small"
                text
                type="danger"
                @click.stop="store.removeRoom(room.id)"
              >
                删除
              </el-button>
            </div>
          </article>
        </div>
      </aside>

      <main class="dashboard-panel">
        <section class="hero-panel glass-panel">
          <div
            class="hero-cover"
            :style="heroCoverStyle"
          />
          <div class="hero-content">
            <div class="hero-profile">
              <img
                v-if="activeRoom?.streamer?.avatar"
                :src="activeRoom.streamer.avatar"
                :alt="activeRoom.streamer.name"
                class="hero-avatar"
              >
              <div
                v-else
                class="hero-avatar room-avatar--placeholder"
              >
                {{ (activeRoom?.roomIdInput || '?').slice(0, 1).toUpperCase() }}
              </div>

              <div class="hero-meta">
                <p class="eyebrow">
                  Streamer Profile
                </p>
                <h2>{{ activeRoom?.streamer?.name || '请选择一个直播间' }}</h2>
                <p>{{ activeRoom?.streamer?.title || '连接后自动加载主播资料与直播标题。' }}</p>
              </div>
            </div>

            <div class="hero-actions">
              <el-input
                v-if="activeRoom"
                :model-value="activeRoom.roomIdInput"
                placeholder="输入直播间号或短号"
                size="large"
                @update:model-value="store.updateRoomInput(activeRoom.id, String($event))"
                @keyup.enter="connectAndOpen(activeRoom.id)"
              />
              <div class="hero-button-row">
                <el-button
                  type="primary"
                  size="large"
                  :disabled="!activeRoom"
                  @click="connectCurrent"
                >
                  连接并打开弹幕窗口
                </el-button>
                <el-button
                  size="large"
                  plain
                  :disabled="!activeRoom"
                  @click="store.reconnectActiveRoom()"
                >
                  重连
                </el-button>
                <el-button
                  size="large"
                  plain
                  :disabled="!activeRoom"
                  @click="openDanmuWindow"
                >
                  聚焦弹幕窗口
                </el-button>
              </div>
            </div>
          </div>
        </section>

        <section class="dashboard-grid">
          <article class="dashboard-card glass-panel">
            <div class="dashboard-card-head">
              <h3>主播信息</h3>
              <el-tag
                size="small"
                :type="activeRoom?.streamer?.liveStatus === 1 ? 'success' : 'info'"
              >
                {{ activeRoom?.streamer?.liveStatus === 1 ? '直播中' : '未开播' }}
              </el-tag>
            </div>
            <div class="info-grid">
              <div class="info-cell">
                <span>粉丝数</span>
                <strong>{{ formatCount(activeRoom?.streamer?.fansCount) }}</strong>
              </div>
              <div class="info-cell">
                <span>舰长数</span>
                <strong>{{ formatCount(activeRoom?.streamer?.guardCount) }}</strong>
              </div>
              <div class="info-cell">
                <span>分区</span>
                <strong>{{ activeRoom?.streamer ? `${activeRoom.streamer.parentAreaName} / ${activeRoom.streamer.areaName}` : '--' }}</strong>
              </div>
              <div class="info-cell">
                <span>当前在线</span>
                <strong>{{ formatCount(activeRoom?.onlineCount) }}</strong>
              </div>
            </div>
          </article>

          <article class="dashboard-card glass-panel">
            <div class="dashboard-card-head">
              <h3>登录状态</h3>
              <el-tag
                size="small"
                :type="authStore.isLoggedIn ? 'success' : 'info'"
              >
                {{ authStore.isLoggedIn ? '已登录' : '未登录' }}
              </el-tag>
            </div>
            <div
              v-if="authStore.user"
              class="auth-user-panel"
            >
              <img
                v-if="authStore.user.avatar"
                :src="authStore.user.avatar"
                :alt="authStore.user.nickname"
                class="auth-user-avatar"
              >
              <div
                v-else
                class="auth-user-avatar auth-user-avatar--placeholder"
              >
                {{ authStore.user.nickname.slice(0, 1).toUpperCase() }}
              </div>
              <div class="auth-user-meta">
                <strong>{{ authStore.user.nickname }}</strong>
                <span>UID {{ authStore.user.uid }}</span>
                <span>Lv.{{ authStore.user.level }}</span>
                <span>粉丝 {{ formatCount(authStore.user.fansCount) }}</span>
              </div>
            </div>
            <div
              v-else
              class="empty-inline"
            >
              登录后将在这里显示 Bilibili 头像、昵称、UID、等级和粉丝数。
            </div>
          </article>

          <article class="dashboard-card glass-panel">
            <div class="dashboard-card-head">
              <h3>连接概览</h3>
            </div>
            <div class="info-grid">
              <div class="info-cell">
                <span>WebSocket</span>
                <strong>{{ activeRoom?.websocketState || 'CLOSED' }}</strong>
              </div>
              <div class="info-cell">
                <span>房间号</span>
                <strong>{{ activeRoom?.resolvedRoomId || activeRoom?.roomIdInput || '--' }}</strong>
              </div>
              <div class="info-cell">
                <span>人气值</span>
                <strong>{{ formatCount(activeRoom?.popularity) }}</strong>
              </div>
              <div class="info-cell">
                <span>延迟</span>
                <strong>{{ activeRoom ? `${activeRoom.wsLatency} ms` : '--' }}</strong>
              </div>
            </div>
          </article>

          <article class="dashboard-card glass-panel">
            <div class="dashboard-card-head">
              <h3>贡献榜 TOP3</h3>
            </div>
            <div
              v-if="activeRoom?.topContributors.length"
              class="ranking-list"
            >
              <div
                v-for="item in activeRoom.topContributors"
                :key="`${item.rank}-${item.username}`"
                class="ranking-row"
              >
                <span>#{{ item.rank }}</span>
                <strong>{{ item.username }}</strong>
                <span>{{ item.score.toFixed(2) }}</span>
              </div>
            </div>
            <div
              v-else
              class="empty-inline"
            >
              连接直播间后，将根据礼物和 SC 自动统计贡献榜。
            </div>
          </article>

          <article class="dashboard-card glass-panel">
            <div class="dashboard-card-head">
              <h3>房间状态</h3>
            </div>
            <div class="info-grid">
              <div class="info-cell">
                <span>已连接房间</span>
                <strong>{{ connectedRoomCount }}</strong>
              </div>
              <div class="info-cell">
                <span>总消息数</span>
                <strong>{{ formatCount(activeRoom?.messageCount) }}</strong>
              </div>
              <div class="info-cell">
                <span>进房人数</span>
                <strong>{{ formatCount(activeRoom?.entryCount) }}</strong>
              </div>
              <div class="info-cell">
                <span>自动恢复</span>
                <strong>{{ activeRoom?.autoConnect ? '开启' : '关闭' }}</strong>
              </div>
            </div>
          </article>
        </section>
      </main>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'

import { useAuthStore } from '../../stores/auth'
import { useDanmuStore } from '../../stores/danmu'
import { useSettingsStore } from '../../stores/settings'
import { initializeTrayListeners } from '../../tray'
import { applyWindowPreferences, initializeWindowState } from '../../window'
import { initializeShortcuts } from '../../window/shortcuts'
import { openAppWindow } from '../shared/manager'

const store = useDanmuStore()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const cleanups: Array<() => void> = []

const activeRoom = computed(() => store.activeRoom)
const connectedRoomCount = computed(() => store.roomList.filter((room) => room.status === 'connected').length)
const heroCoverStyle = computed(() => ({
  backgroundImage: activeRoom.value?.streamer?.cover
    ? `linear-gradient(135deg, rgba(9, 12, 20, 0.82), rgba(9, 12, 20, 0.28)), url(${activeRoom.value.streamer.cover})`
    : 'linear-gradient(135deg, rgba(79, 140, 255, 0.28), rgba(125, 107, 255, 0.14))',
}))

function formatCount(value?: number): string {
  return (value ?? 0).toLocaleString('zh-CN')
}

function resolveStatusType(status: string): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'connected') {
    return 'success'
  }

  if (status === 'connecting' || status === 'reconnecting') {
    return 'warning'
  }

  if (status === 'error') {
    return 'danger'
  }

  return 'info'
}

async function connectAndOpen(roomId: string): Promise<void> {
  await store.connectRoom(roomId)

  if (store.rooms[roomId]?.status === 'connected') {
    store.setActiveRoom(roomId)
    await openAppWindow('danmu')
  }
}

async function connectCurrent(): Promise<void> {
  if (!activeRoom.value) {
    return
  }

  await connectAndOpen(activeRoom.value.id)
}

async function openDanmuWindow(): Promise<void> {
  await openAppWindow('danmu')
}

async function openSettings(): Promise<void> {
  await openAppWindow('settings')
}

async function openLogin(): Promise<void> {
  await openAppWindow('login')
}

async function openDebug(): Promise<void> {
  await openAppWindow('debug')
}

async function openCrashWindow(): Promise<void> {
  await openAppWindow('crash')
}

async function openOverlayStudio(): Promise<void> {
  await openAppWindow('overlay-studio')
}

onMounted(async () => {
  settingsStore.initialize()
  await authStore.initialize()
  await store.initialize()
  cleanups.push(await initializeWindowState())
  cleanups.push(await initializeTrayListeners({
    onToggleObs: () => {
      settingsStore.toggleObsMode()
      void openDanmuWindow()
    },
    onOpenSettings: () => {
      void openSettings()
    },
  }))
  cleanups.push(initializeShortcuts({
    reconnect: () => store.reconnectActiveRoom(),
    clearMessages: () => store.clearActiveMessages(),
    toggleObs: () => settingsStore.toggleObsMode(),
    openSettings: () => {
      void openSettings()
    },
  }))

  await applyWindowPreferences(settingsStore.settings)
})

watch(
  () => settingsStore.settings,
  (settings) => {
    store.applyMessageLimit(settings.maxMessages)
    void applyWindowPreferences(settings)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  cleanups.forEach((cleanup) => cleanup())
})
</script>
