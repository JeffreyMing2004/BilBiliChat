<template>
  <el-drawer
    :model-value="settingsStore.settingsVisible"
    size="420px"
    :with-header="false"
    class="settings-drawer"
    @close="settingsStore.setSettingsVisible(false)"
  >
    <section class="drawer-content">
      <div class="drawer-head">
        <div>
          <p class="eyebrow">
            Settings
          </p>
          <h2>LiveDanmu 设置中心</h2>
        </div>
        <el-button
          text
          @click="settingsStore.setSettingsVisible(false)"
        >
          关闭
        </el-button>
      </div>

      <div class="settings-group">
        <h3>显示与窗口</h3>
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
          <span>弹幕透明度 {{ settingsStore.settings.overlayOpacity }}%</span>
          <el-slider
            :model-value="settingsStore.settings.overlayOpacity"
            :min="10"
            :max="100"
            @update:model-value="patch({ overlayOpacity: Number($event) })"
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
          <span>音效开关</span>
          <el-switch
            :model-value="settingsStore.settings.soundEnabled"
            @change="patch({ soundEnabled: Boolean($event) })"
          />
        </div>
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
    </section>
  </el-drawer>
</template>

<script setup lang="ts">
import { exportRoomMessagesAsJson, exportRoomMessagesAsTxt } from '../export'
import { useDanmuStore } from '../stores/danmu'
import { useSettingsStore } from '../stores/settings'
import type { AppSettings } from '../types/settings'

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
</script>
