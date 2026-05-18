<template>
  <section class="settings-window glass-panel">
    <div class="settings-window-head">
      <div data-tauri-drag-region>
        <p class="eyebrow">
          Settings
        </p>
        <h2>{{ title }}</h2>
        <p class="settings-window-desc">
          {{ description }}
        </p>
      </div>
      <slot name="actions" />
    </div>

    <div class="settings-group">
      <h3>显示与窗口</h3>
      <div class="settings-item">
        <span>主题预设</span>
        <el-radio-group
          :model-value="settingsStore.settings.theme"
          @change="patch({ theme: $event })"
        >
          <el-radio-button label="dark">
            Dark
          </el-radio-button>
          <el-radio-button label="obs">
            OBS
          </el-radio-button>
          <el-radio-button label="neon">
            Neon
          </el-radio-button>
          <el-radio-button label="bilibili">
            Bilibili
          </el-radio-button>
        </el-radio-group>
      </div>
      <div class="settings-item">
        <span>直播连接源</span>
        <el-radio-group
          :model-value="settingsStore.settings.liveProvider"
          @change="patch({ liveProvider: $event })"
        >
          <el-radio-button label="public">
            Public WS
          </el-radio-button>
          <el-radio-button label="open-live">
            OpenLive
          </el-radio-button>
        </el-radio-group>
      </div>
      <label
        v-if="settingsStore.settings.liveProvider === 'open-live'"
        class="textarea-item"
      >
        <span>OpenLive 官方身份码</span>
        <el-input
          :model-value="settingsStore.settings.openLiveIdentityCode"
          placeholder="输入 Bilibili OpenLive 身份码"
          @update:model-value="patch({ openLiveIdentityCode: String($event) })"
        />
      </label>
      <div class="settings-item">
        <span>OBS 模式</span>
        <el-switch
          :model-value="settingsStore.settings.obsMode"
          @change="settingsStore.toggleObsMode(Boolean($event))"
        />
      </div>
      <div class="settings-item">
        <span>自动重连</span>
        <el-switch
          :model-value="settingsStore.settings.autoReconnect"
          @change="patch({ autoReconnect: Boolean($event) })"
        />
      </div>
      <div class="settings-item">
        <span>点击穿透</span>
        <el-switch
          :model-value="settingsStore.settings.clickThrough"
          @change="patch({ clickThrough: Boolean($event) })"
        />
      </div>
      <div class="settings-item">
        <span>置顶显示</span>
        <el-switch
          :model-value="settingsStore.settings.alwaysOnTop"
          @change="patch({ alwaysOnTop: Boolean($event) })"
        />
      </div>
      <div class="settings-item">
        <span>最小化到托盘</span>
        <el-switch
          :model-value="settingsStore.settings.minimizeToTray"
          @change="patch({ minimizeToTray: Boolean($event) })"
        />
      </div>
      <div class="settings-actions">
        <el-button
          plain
          @click="openOverlayStudio"
        >
          打开 Overlay Studio
        </el-button>
      </div>
    </div>

    <div class="settings-group">
      <h3>Overlay 样式</h3>
      <label class="slider-item">
        <span>字体大小 {{ settingsStore.settings.fontSize }}px</span>
        <el-slider
          :model-value="settingsStore.settings.fontSize"
          :min="18"
          :max="64"
          @update:model-value="patch({ fontSize: Number($event) })"
        />
      </label>
      <label class="slider-item">
        <span>字体粗细 {{ settingsStore.settings.fontWeight }}</span>
        <el-slider
          :model-value="settingsStore.settings.fontWeight"
          :min="400"
          :max="900"
          :step="100"
          @update:model-value="patch({ fontWeight: Number($event) })"
        />
      </label>
      <label class="slider-item">
        <span>描边宽度 {{ settingsStore.settings.strokeWidth }}px</span>
        <el-slider
          :model-value="settingsStore.settings.strokeWidth"
          :min="0"
          :max="6"
          :step="1"
          @update:model-value="patch({ strokeWidth: Number($event) })"
        />
      </label>
      <label class="slider-item">
        <span>弹幕透明度 {{ settingsStore.settings.overlayOpacity }}%</span>
        <el-slider
          :model-value="settingsStore.settings.overlayOpacity"
          :min="10"
          :max="100"
          @update:model-value="patch({ overlayOpacity: Number($event) })"
        />
      </label>
      <label class="slider-item">
        <span>X 偏移 {{ settingsStore.settings.overlayOffsetX }}px</span>
        <el-slider
          :model-value="settingsStore.settings.overlayOffsetX"
          :min="0"
          :max="1600"
          @update:model-value="patch({ overlayOffsetX: Number($event) })"
        />
      </label>
      <label class="slider-item">
        <span>Y 偏移 {{ settingsStore.settings.overlayOffsetY }}px</span>
        <el-slider
          :model-value="settingsStore.settings.overlayOffsetY"
          :min="0"
          :max="900"
          @update:model-value="patch({ overlayOffsetY: Number($event) })"
        />
      </label>
      <label class="slider-item">
        <span>弹幕间距 {{ settingsStore.settings.messageSpacing }}px</span>
        <el-slider
          :model-value="settingsStore.settings.messageSpacing"
          :min="4"
          :max="32"
          @update:model-value="patch({ messageSpacing: Number($event) })"
        />
      </label>
      <label class="slider-item">
        <span>动画速度 {{ settingsStore.settings.animationSpeed.toFixed(1) }}s</span>
        <el-slider
          :model-value="settingsStore.settings.animationSpeed"
          :min="0.4"
          :max="1.8"
          :step="0.1"
          @update:model-value="patch({ animationSpeed: Number($event) })"
        />
      </label>
      <label class="slider-item">
        <span>阴影模糊 {{ settingsStore.settings.overlayShadowBlur }}px</span>
        <el-slider
          :model-value="settingsStore.settings.overlayShadowBlur"
          :min="0"
          :max="48"
          @update:model-value="patch({ overlayShadowBlur: Number($event) })"
        />
      </label>
      <label class="slider-item">
        <span>阴影透明度 {{ settingsStore.settings.overlayShadowOpacity }}%</span>
        <el-slider
          :model-value="settingsStore.settings.overlayShadowOpacity"
          :min="0"
          :max="100"
          @update:model-value="patch({ overlayShadowOpacity: Number($event) })"
        />
      </label>
      <label class="slider-item">
        <span>礼物高亮 {{ settingsStore.settings.giftAccentStrength }}%</span>
        <el-slider
          :model-value="settingsStore.settings.giftAccentStrength"
          :min="0"
          :max="100"
          @update:model-value="patch({ giftAccentStrength: Number($event) })"
        />
      </label>
      <label class="slider-item">
        <span>SC 高亮 {{ settingsStore.settings.superChatAccentStrength }}%</span>
        <el-slider
          :model-value="settingsStore.settings.superChatAccentStrength"
          :min="0"
          :max="100"
          @update:model-value="patch({ superChatAccentStrength: Number($event) })"
        />
      </label>
      <div class="settings-item">
        <span>弹幕方向</span>
        <el-radio-group
          :model-value="settingsStore.settings.direction"
          @change="patch({ direction: $event })"
        >
          <el-radio-button label="bottom-up">
            底部追加
          </el-radio-button>
          <el-radio-button label="top-down">
            顶部追加
          </el-radio-button>
        </el-radio-group>
      </div>
      <div class="settings-item">
        <span>动画开关</span>
        <el-switch
          :model-value="settingsStore.settings.animationsEnabled"
          @change="patch({ animationsEnabled: Boolean($event) })"
        />
      </div>
    </div>

    <div class="settings-group">
      <h3>过滤与性能</h3>
      <div class="settings-item">
        <span>最大消息数量</span>
        <el-input-number
          :model-value="settingsStore.settings.maxMessages"
          :min="100"
          :max="500"
          @change="patch({ maxMessages: Number($event ?? 500) })"
        />
      </div>
      <div class="settings-item">
        <span>礼物消息</span>
        <el-switch
          :model-value="settingsStore.settings.hideGift"
          @change="patch({ hideGift: Boolean($event) })"
        />
      </div>
      <div class="settings-item">
        <span>进入提示</span>
        <el-switch
          :model-value="settingsStore.settings.hideEntry"
          @change="patch({ hideEntry: Boolean($event) })"
        />
      </div>
      <div class="settings-item">
        <span>系统消息</span>
        <el-switch
          :model-value="settingsStore.settings.hideSystem"
          @change="patch({ hideSystem: Boolean($event) })"
        />
      </div>
      <div class="settings-item">
        <span>SC 消息</span>
        <el-switch
          :model-value="settingsStore.settings.hideSuperChat"
          @change="patch({ hideSuperChat: Boolean($event) })"
        />
      </div>
      <div class="settings-item">
        <span>音效开关</span>
        <el-switch
          :model-value="settingsStore.settings.soundEnabled"
          @change="patch({ soundEnabled: Boolean($event) })"
        />
      </div>
      <label class="slider-item">
        <span>音量 {{ settingsStore.settings.soundVolume }}%</span>
        <el-slider
          :model-value="settingsStore.settings.soundVolume"
          :min="0"
          :max="100"
          @update:model-value="patch({ soundVolume: Number($event) })"
        />
      </label>
      <div class="settings-item">
        <span>重复弹幕过滤</span>
        <el-switch
          :model-value="settingsStore.settings.dedupeEnabled"
          @change="patch({ dedupeEnabled: Boolean($event) })"
        />
      </div>
      <label class="slider-item">
        <span>重复过滤窗口 {{ settingsStore.settings.dedupeWindowSeconds }}s</span>
        <el-slider
          :model-value="settingsStore.settings.dedupeWindowSeconds"
          :min="1"
          :max="60"
          @update:model-value="patch({ dedupeWindowSeconds: Number($event) })"
        />
      </label>
      <label class="textarea-item">
        <span>关键词过滤</span>
        <el-input
          :model-value="settingsStore.settings.keywordFiltersText"
          type="textarea"
          :rows="3"
          placeholder="每行一个关键词，也支持逗号分隔"
          @update:model-value="patch({ keywordFiltersText: String($event) })"
        />
      </label>
      <label class="textarea-item">
        <span>用户黑名单</span>
        <el-input
          :model-value="settingsStore.settings.userBlacklistText"
          type="textarea"
          :rows="3"
          placeholder="每行一个用户名"
          @update:model-value="patch({ userBlacklistText: String($event) })"
        />
      </label>
      <label class="textarea-item">
        <span>礼物音效 URL</span>
        <el-input
          :model-value="settingsStore.settings.customGiftSound"
          placeholder="留空则使用默认提示音"
          @update:model-value="patch({ customGiftSound: String($event) })"
        />
      </label>
      <label class="textarea-item">
        <span>SC 音效 URL</span>
        <el-input
          :model-value="settingsStore.settings.customScSound"
          placeholder="留空则使用默认提示音"
          @update:model-value="patch({ customScSound: String($event) })"
        />
      </label>
      <label class="textarea-item">
        <span>进房音效 URL</span>
        <el-input
          :model-value="settingsStore.settings.customEntrySound"
          placeholder="留空则使用默认提示音"
          @update:model-value="patch({ customEntrySound: String($event) })"
        />
      </label>
    </div>

    <div class="settings-group">
      <h3>自动更新</h3>
      <div class="settings-item">
        <span>启用自动更新</span>
        <el-switch
          :model-value="settingsStore.settings.updaterEnabled"
          @change="patch({ updaterEnabled: Boolean($event) })"
        />
      </div>
      <div class="settings-item">
        <span>启动时自动检查</span>
        <el-switch
          :model-value="settingsStore.settings.autoCheckUpdates"
          @change="patch({ autoCheckUpdates: Boolean($event) })"
        />
      </div>
      <div class="settings-item">
        <span>更新渠道</span>
        <el-radio-group
          :model-value="settingsStore.settings.updateChannel"
          @change="changeUpdateChannel"
        >
          <el-radio-button label="stable">
            Stable
          </el-radio-button>
          <el-radio-button label="beta">
            Beta
          </el-radio-button>
          <el-radio-button label="nightly">
            Nightly
          </el-radio-button>
        </el-radio-group>
      </div>
      <div class="settings-item">
        <span>当前版本</span>
        <strong>{{ updaterState.currentVersion }}</strong>
      </div>
      <div class="settings-item">
        <span>可用更新</span>
        <strong>{{ updaterState.availableVersion || '暂无' }}</strong>
      </div>
      <div
        v-if="updaterState.lastError"
        class="error-banner"
      >
        {{ updaterState.lastError }}
      </div>
      <div
        v-if="updaterState.notes"
        class="update-notes"
      >
        <h4>更新日志</h4>
        <pre>{{ updaterState.notes }}</pre>
      </div>
      <div class="settings-actions">
        <el-button
          :loading="updaterState.checking"
          :disabled="!settingsStore.settings.updaterEnabled"
          @click="checkUpdates"
        >
          检查更新
        </el-button>
        <el-button
          type="primary"
          :loading="updaterState.installing"
          :disabled="!updaterState.availableVersion"
          @click="installUpdate"
        >
          下载并安装
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
        <span v-if="updaterState.installing">进度 {{ updaterState.progress }}%</span>
      </div>
    </div>

    <div class="settings-group">
      <h3>导出</h3>
      <div class="settings-actions">
        <el-button
          :disabled="!store.activeRoom"
          @click="exportTxt"
        >
          导出 TXT
        </el-button>
        <el-button
          :disabled="!store.activeRoom"
          @click="exportJson"
        >
          导出 JSON
        </el-button>
        <el-button
          text
          @click="settingsStore.resetSettings()"
        >
          恢复默认
        </el-button>
      </div>
    </div>

    <div class="settings-group">
      <h3>配置同步</h3>
      <p class="settings-helper">
        支持导出完整 JSON 配置，包含 Overlay、更新渠道和插件启用状态。
      </p>
      <div class="settings-actions">
        <el-button
          plain
          @click="exportConfig"
        >
          导出配置 JSON
        </el-button>
        <el-button
          type="primary"
          plain
          @click="importConfig"
        >
          导入配置 JSON
        </el-button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'

import { exportRoomMessagesAsJson, exportRoomMessagesAsTxt } from '../export'
import { pluginManager } from '../core/plugins/PluginManager'
import { importProductConfig, exportProductConfig } from '../modules/sync'
import {
  checkForAppUpdates,
  downloadAndInstallUpdate,
  downloadUpdatePackage,
  installDownloadedUpdate,
  setUpdateChannel,
  updaterState,
} from '../modules/updater'
import { useDanmuStore } from '../stores/danmu'
import { useSettingsStore } from '../stores/settings'
import type { AppSettings } from '../types/settings'
import { openAppWindow } from '../windows/shared/manager'

withDefaults(defineProps<{
  title?: string
  description?: string
}>(), {
  title: 'LiveDanmu 设置中心',
  description: '集中调整 OBS Overlay、过滤器、性能和导出选项。',
})

const store = useDanmuStore()
const settingsStore = useSettingsStore()

function patch(partial: Partial<AppSettings>): void {
  settingsStore.patchSettings(partial)
}

function exportTxt(): void {
  if (!store.activeRoom) {
    return
  }

  exportRoomMessagesAsTxt(store.activeRoom)
}

function exportJson(): void {
  if (!store.activeRoom) {
    return
  }

  exportRoomMessagesAsJson(store.activeRoom)
}

async function checkUpdates(): Promise<void> {
  const available = await checkForAppUpdates(settingsStore.settings.updateChannel)
  ElMessage.success(available ? '发现新版本' : '当前已经是最新版本')
}

function changeUpdateChannel(channel: AppSettings['updateChannel']): void {
  patch({ updateChannel: channel })
  setUpdateChannel(channel)
}

async function installUpdate(): Promise<void> {
  const completed = await downloadAndInstallUpdate()
  if (!completed && updaterState.lastError) {
    ElMessage.error(updaterState.lastError)
  }
}

async function downloadUpdate(): Promise<void> {
  const completed = await downloadUpdatePackage()
  if (completed) {
    ElMessage.success('更新包已在后台下载完成')
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

async function openOverlayStudio(): Promise<void> {
  await openAppWindow('overlay-studio')
}

async function exportConfig(): Promise<void> {
  const enabledPluginIds = pluginManager.getState().filter((plugin) => plugin.enabled).map((plugin) => plugin.id)
  const content = exportProductConfig(settingsStore.settings, enabledPluginIds)

  await ElMessageBox.alert(content, '配置导出 JSON', {
    confirmButtonText: '关闭',
    dangerouslyUseHTMLString: false,
  })
}

async function importConfig(): Promise<void> {
  const { value } = await ElMessageBox.prompt('粘贴配置 JSON', '配置导入', {
    inputType: 'textarea',
    inputPlaceholder: '{ "version": 1, ... }',
    confirmButtonText: '导入',
    cancelButtonText: '取消',
  })

  const snapshot = importProductConfig(value)
  settingsStore.patchSettings(snapshot.settings)
  ElMessage.success(`配置已导入，插件启用数量 ${snapshot.plugins.enabledIds.length}`)
}
</script>
