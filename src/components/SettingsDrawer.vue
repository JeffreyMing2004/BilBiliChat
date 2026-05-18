<template>
  <el-drawer
    v-model="visible"
    title="界面设置"
    size="360px"
  >
    <div class="settings-content">
      <div class="settings-item">
        <span>最大消息缓存</span>
        <el-input-number
          :model-value="store.config.maxMessages"
          :min="100"
          :max="1000"
          :step="50"
          controls-position="right"
          @change="onMaxMessagesChange"
        />
      </div>

      <div class="settings-item">
        <span>自动连接</span>
        <el-switch
          :model-value="store.config.autoConnect"
          @change="onAutoConnectChange"
        />
      </div>

      <div class="settings-item settings-tip">
        <p>当前版本已支持普通弹幕、礼物、用户进入和醒目留言解析。</p>
        <p>配置使用 Tauri Store 持久化保存在本地。</p>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useDanmuStore } from '../stores/danmu'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const store = useDanmuStore()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

function onMaxMessagesChange(value: number | undefined): void {
  void store.updateConfig({ maxMessages: Number(value ?? 300) })
}

function onAutoConnectChange(value: string | number | boolean): void {
  void store.updateConfig({ autoConnect: Boolean(value) })
}
</script>
