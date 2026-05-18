<template>
  <div
    class="window-shell studio-shell"
    :style="settingsStore.overlayStyleVars"
  >
    <header class="studio-topbar glass-panel">
      <div>
        <p class="eyebrow">
          Overlay Studio
        </p>
        <h1>OBS Overlay Studio</h1>
        <p class="window-subtitle">
          实时编辑弹幕舞台、礼物特效与 SC 样式，并直接预览最终 OBS 输出。
        </p>
      </div>

      <div class="studio-actions">
        <el-button
          plain
          @click="resetToDefault"
        >
          恢复默认
        </el-button>
        <el-button
          plain
          @click="copyPreset"
        >
          导出模板
        </el-button>
        <el-button
          type="primary"
          @click="closeWindow"
        >
          关闭窗口
        </el-button>
      </div>
    </header>

    <section class="studio-layout">
      <aside class="studio-sidebar glass-panel">
        <div class="studio-section">
          <h3>模板预设</h3>
          <div class="preset-list">
            <button
              v-for="preset in BUILTIN_OVERLAY_PRESETS"
              :key="preset.name"
              class="preset-card"
              type="button"
              @click="applyPreset(preset)"
            >
              <strong>{{ preset.name }}</strong>
              <span>{{ preset.description }}</span>
            </button>
          </div>
        </div>

        <div class="studio-section">
          <h3>布局与透明度</h3>
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
            <span>透明度 {{ settingsStore.settings.overlayOpacity }}%</span>
            <el-slider
              :model-value="settingsStore.settings.overlayOpacity"
              :min="10"
              :max="100"
              @update:model-value="patch({ overlayOpacity: Number($event) })"
            />
          </label>
          <label class="slider-item">
            <span>间距 {{ settingsStore.settings.messageSpacing }}px</span>
            <el-slider
              :model-value="settingsStore.settings.messageSpacing"
              :min="4"
              :max="32"
              @update:model-value="patch({ messageSpacing: Number($event) })"
            />
          </label>
        </div>

        <div class="studio-section">
          <h3>文字与描边</h3>
          <label class="slider-item">
            <span>字体 {{ settingsStore.settings.fontSize }}px</span>
            <el-slider
              :model-value="settingsStore.settings.fontSize"
              :min="18"
              :max="72"
              @update:model-value="patch({ fontSize: Number($event) })"
            />
          </label>
          <label class="slider-item">
            <span>粗细 {{ settingsStore.settings.fontWeight }}</span>
            <el-slider
              :model-value="settingsStore.settings.fontWeight"
              :min="400"
              :max="900"
              :step="100"
              @update:model-value="patch({ fontWeight: Number($event) })"
            />
          </label>
          <label class="slider-item">
            <span>描边 {{ settingsStore.settings.strokeWidth }}px</span>
            <el-slider
              :model-value="settingsStore.settings.strokeWidth"
              :min="0"
              :max="6"
              @update:model-value="patch({ strokeWidth: Number($event) })"
            />
          </label>
          <label class="slider-item">
            <span>阴影 {{ settingsStore.settings.overlayShadowBlur }}px</span>
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
        </div>

        <div class="studio-section">
          <h3>动画与高亮</h3>
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
                底部堆叠
              </el-radio-button>
              <el-radio-button label="top-down">
                顶部堆叠
              </el-radio-button>
            </el-radio-group>
          </div>
        </div>

        <div class="studio-section">
          <h3>模板导入</h3>
          <el-input
            v-model="presetDraft"
            type="textarea"
            :rows="10"
            placeholder="可粘贴 Overlay 模板 JSON 或导出结果"
          />
          <div class="settings-actions">
            <el-button
              plain
              @click="fillCurrentPreset"
            >
              生成当前模板
            </el-button>
            <el-button
              type="primary"
              @click="importPreset"
            >
              应用模板
            </el-button>
          </div>
        </div>

        <div class="studio-section">
          <h3>自定义 CSS</h3>
          <el-input
            :model-value="settingsStore.settings.overlayCustomCss"
            type="textarea"
            :rows="8"
            placeholder=".overlay-studio-preview-item { letter-spacing: 1px; }"
            @update:model-value="patch({ overlayCustomCss: String($event) })"
          />
        </div>
      </aside>

      <main class="studio-preview-panel glass-panel">
        <div class="preview-toolbar">
          <div>
            <h3>实时舞台预览</h3>
            <p>拖拽预览卡片即可调整最终 Overlay 位置，适配 OBS 透明背景和高 DPI 输出。</p>
          </div>
          <el-tag effect="dark">
            {{ settingsStore.settings.liveProvider === 'open-live' ? 'OpenLive' : 'Public WS' }}
          </el-tag>
        </div>

        <div
          ref="previewStageRef"
          class="preview-stage"
          @pointermove="onPointerMove"
          @pointerup="stopDragging"
          @pointerleave="stopDragging"
        >
          <div class="preview-stage-grid" />
          <div class="preview-stage-caption">
            1920 x 1080 透明舞台
          </div>
          <div
            class="preview-shell"
            :style="previewShellStyle"
          >
            <button
              type="button"
              class="preview-drag-handle"
              @pointerdown="startDragging"
            >
              拖拽 Overlay 区块
            </button>

            <article
              v-for="message in previewMessages"
              :key="message.id"
              class="overlay-studio-preview-item"
              :class="`is-${message.type}`"
              :style="previewItemStyle(message.type)"
            >
              <header>
                <strong>{{ message.username }}</strong>
                <span v-if="message.price">￥{{ message.price }}</span>
              </header>
              <p>{{ message.content }}</p>
            </article>
          </div>
        </div>
      </main>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'

import { logError } from '../../core/logger/Logger'
import {
  applyOverlayPreset,
  BUILTIN_OVERLAY_PRESETS,
  createOverlayPreset,
  OVERLAY_STUDIO_SAMPLE_MESSAGES,
  parseOverlayPreset,
  serializeOverlayPreset,
} from '../../modules/overlay-studio'
import { DEFAULT_SETTINGS } from '../../modules/settings'
import { useSettingsStore } from '../../stores/settings'
import type { AppSettings } from '../../types/settings'
import { closeCurrentWindow } from '../shared/manager'

const settingsStore = useSettingsStore()
settingsStore.initialize()

const presetDraft = ref('')
const previewStageRef = ref<HTMLDivElement | null>(null)
const dragging = ref(false)
const dragStart = ref({ pointerX: 0, pointerY: 0, offsetX: 0, offsetY: 0 })

const previewMessages = OVERLAY_STUDIO_SAMPLE_MESSAGES

const previewShellStyle = computed<Record<string, string>>(() => ({
  left: `${settingsStore.settings.overlayOffsetX}px`,
  top: `${settingsStore.settings.overlayOffsetY}px`,
  opacity: String(settingsStore.settings.overlayOpacity / 100),
  gap: `${settingsStore.settings.messageSpacing}px`,
  fontSize: `${settingsStore.settings.fontSize}px`,
  fontWeight: String(settingsStore.settings.fontWeight),
  WebkitTextStrokeWidth: `${settingsStore.settings.strokeWidth}px`,
  textShadow: `0 0 ${settingsStore.settings.overlayShadowBlur}px rgba(0, 0, 0, ${settingsStore.settings.overlayShadowOpacity / 100})`,
}))

function patch(partial: Partial<AppSettings>): void {
  settingsStore.patchSettings(partial)
}

function applyPreset(preset: ReturnType<typeof parseOverlayPreset> | typeof BUILTIN_OVERLAY_PRESETS[number]): void {
  settingsStore.patchSettings(applyOverlayPreset(settingsStore.settings, preset))
  ElMessage.success(`已应用模板：${preset.name}`)
}

function previewItemStyle(type: 'danmu' | 'gift' | 'superChat'): Record<string, string> {
  if (type === 'gift') {
    return {
      background: `linear-gradient(135deg, rgba(255, 209, 102, ${Math.max(0.18, settingsStore.settings.giftAccentStrength / 100)}), rgba(255, 255, 255, 0.08))`,
    }
  }

  if (type === 'superChat') {
    return {
      background: `linear-gradient(135deg, rgba(255, 122, 69, ${Math.max(0.24, settingsStore.settings.superChatAccentStrength / 100)}), rgba(255, 255, 255, 0.08))`,
    }
  }

  return {
    background: 'rgba(15, 23, 42, 0.42)',
  }
}

function fillCurrentPreset(): void {
  const preset = createOverlayPreset('当前工作区模板', '由 Overlay Studio 当前设置生成', settingsStore.settings)
  presetDraft.value = serializeOverlayPreset(preset)
}

async function copyPreset(): Promise<void> {
  fillCurrentPreset()

  try {
    await navigator.clipboard.writeText(presetDraft.value)
    ElMessage.success('模板 JSON 已复制到剪贴板')
  } catch {
    ElMessage.info('当前环境不支持剪贴板，已在左侧文本框中生成模板 JSON')
  }
}

function importPreset(): void {
  try {
    const preset = parseOverlayPreset(presetDraft.value)
    applyPreset(preset)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '模板导入失败')
  }
}

function resetToDefault(): void {
  settingsStore.patchSettings(DEFAULT_SETTINGS)
  ElMessage.success('Overlay 设置已恢复默认值')
}

function startDragging(event: PointerEvent): void {
  dragging.value = true
  dragStart.value = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    offsetX: settingsStore.settings.overlayOffsetX,
    offsetY: settingsStore.settings.overlayOffsetY,
  }
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging.value || !previewStageRef.value) {
    return
  }

  const bounds = previewStageRef.value.getBoundingClientRect()
  const nextX = Math.min(
    bounds.width - 420,
    Math.max(0, dragStart.value.offsetX + (event.clientX - dragStart.value.pointerX)),
  )
  const nextY = Math.min(
    bounds.height - 240,
    Math.max(0, dragStart.value.offsetY + (event.clientY - dragStart.value.pointerY)),
  )

  patch({
    overlayOffsetX: Math.round(nextX),
    overlayOffsetY: Math.round(nextY),
  })
}

function stopDragging(): void {
  dragging.value = false
}

async function closeWindow(): Promise<void> {
  try {
    await closeCurrentWindow()
  } catch (error) {
    const message = error instanceof Error ? error.message : '关闭 Overlay Studio 失败'
    logError('windows', message)
    ElMessage.error(message)
  }
}
</script>

<style scoped>
.studio-shell {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100vh;
  padding: 24px;
}

.studio-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 24px;
}

.studio-actions {
  display: flex;
  gap: 12px;
}

.studio-layout {
  display: grid;
  grid-template-columns: 420px minmax(0, 1fr);
  gap: 20px;
  min-height: 0;
  flex: 1;
}

.studio-sidebar,
.studio-preview-panel {
  min-height: 0;
  padding: 20px;
}

.studio-sidebar {
  overflow: auto;
}

.studio-section + .studio-section {
  margin-top: 24px;
}

.studio-section h3 {
  margin: 0 0 12px;
}

.preset-list {
  display: grid;
  gap: 12px;
}

.preset-card {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.45);
  color: inherit;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
}

.preset-card strong,
.preset-card span {
  display: block;
}

.preset-card span {
  margin-top: 6px;
  color: rgba(226, 232, 240, 0.72);
  font-size: 13px;
}

.preview-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.preview-toolbar h3 {
  margin: 0 0 4px;
}

.preview-toolbar p {
  margin: 0;
  color: rgba(226, 232, 240, 0.72);
}

.preview-stage {
  position: relative;
  height: calc(100vh - 210px);
  min-height: 620px;
  overflow: hidden;
  border-radius: 28px;
  background:
    radial-gradient(circle at top, rgba(0, 174, 236, 0.14), transparent 32%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.58), rgba(15, 23, 42, 0.2));
}

.preview-stage-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 48px 48px;
  opacity: 0.6;
}

.preview-stage-caption {
  position: absolute;
  right: 20px;
  top: 20px;
  font-size: 12px;
  color: rgba(226, 232, 240, 0.74);
}

.preview-shell {
  position: absolute;
  display: flex;
  flex-direction: column;
  width: min(540px, calc(100% - 48px));
}

.preview-drag-handle {
  align-self: flex-start;
  margin-bottom: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.65);
  color: rgba(226, 232, 240, 0.9);
  padding: 8px 12px;
  cursor: grab;
}

.overlay-studio-preview-item {
  border-radius: 18px;
  padding: 14px 18px;
  backdrop-filter: blur(18px);
  color: rgba(255, 255, 255, 0.96);
}

.overlay-studio-preview-item header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 0.76em;
  opacity: 0.88;
}

.overlay-studio-preview-item p {
  margin: 0;
  line-height: 1.45;
}

.settings-item,
.settings-actions {
  margin-top: 12px;
}
</style>
