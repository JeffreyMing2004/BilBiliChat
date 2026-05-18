import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'

import type { DanmuConfig, DanmuMessageItem, LiveRoomInfo, StatusSnapshot } from '../types/danmu'
import { emitLog, onLog, type LogRecord } from '../utils/logger'
import { saveConfig, loadConfig } from '../utils/persist'
import { formatTime } from '../utils/time'
import { BilibiliDanmuClient } from '../websocket/client'

function createDefaultConfig(): DanmuConfig {
  return {
    roomId: '',
    autoConnect: false,
    maxMessages: 300,
    reconnectInterval: 5,
  }
}

function createDefaultStatus(): StatusSnapshot {
  return {
    roomId: '',
    resolvedRoomId: null,
    title: '未连接直播间',
    anchorName: '--',
    popularity: 0,
    currentHost: '--',
    status: 'idle',
    statusText: '等待连接',
    lastError: '',
  }
}

export const useDanmuStore = defineStore('danmu', () => {
  const config = ref<DanmuConfig>(createDefaultConfig())
  const status = ref<StatusSnapshot>(createDefaultStatus())
  const messages = ref<DanmuMessageItem[]>([])
  const logs = ref<LogRecord[]>([])
  const initialized = ref(false)
  const isConnecting = ref(false)

  let client: BilibiliDanmuClient | null = null
  let unlistenLog: (() => void) | null = null

  const groupedStatus = computed(() => ({
    isConnected: status.value.status === 'connected',
    isBusy: status.value.status === 'connecting' || status.value.status === 'reconnecting',
  }))

  function addMessage(message: DanmuMessageItem): void {
    messages.value.push(message)

    if (messages.value.length > config.value.maxMessages) {
      messages.value.splice(0, messages.value.length - config.value.maxMessages)
    }
  }

  function addSystemMessage(content: string): void {
    addMessage({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'system',
      username: '系统',
      userColor: '#90a6d4',
      content,
      timestamp: formatTime(),
      rawCommand: 'SYSTEM',
    })
  }

  function updateStatus(payload: Partial<StatusSnapshot>): void {
    status.value = {
      ...status.value,
      ...payload,
    }
  }

  function bindLogger(): void {
    if (unlistenLog) {
      return
    }

    unlistenLog = onLog((log) => {
      logs.value.unshift(log)
      logs.value = logs.value.slice(0, 120)
    })
  }

  async function persistConfig(): Promise<void> {
    await saveConfig(config.value)
  }

  async function initialize(): Promise<void> {
    if (initialized.value) {
      return
    }

    config.value = await loadConfig()
    status.value.roomId = config.value.roomId
    bindLogger()
    initialized.value = true

    if (config.value.autoConnect && config.value.roomId.trim()) {
      await connect()
    }
  }

  async function connect(): Promise<void> {
    const roomId = config.value.roomId.trim()

    if (!roomId) {
      ElMessage.warning('请先输入直播间号')
      return
    }

    disconnect(false)
    isConnecting.value = true
    updateStatus({
      roomId,
      status: 'connecting',
      statusText: '正在初始化连接',
      lastError: '',
    })

    client = new BilibiliDanmuClient({
      roomId,
      reconnectInterval: config.value.reconnectInterval,
      onStatus: ({ status: nextStatus, statusText, currentHost, error }) => {
        updateStatus({
          status: nextStatus,
          statusText,
          currentHost: currentHost ?? status.value.currentHost,
          lastError: error ?? '',
        })
      },
      onMessage: (message) => {
        addMessage(message)
      },
      onPopularity: (popularity) => {
        updateStatus({ popularity })
      },
      onRoomInfo: (roomInfo: LiveRoomInfo, resolvedRoomId: number) => {
        updateStatus({
          resolvedRoomId,
          title: roomInfo.title,
          anchorName: roomInfo.anchorName,
        })
        addSystemMessage(`已进入直播间：${roomInfo.title}`)
      },
    })

    try {
      await persistConfig()
      await client.connect()
      emitLog('info', `开始连接直播间 ${roomId}`)
      ElMessage.success('正在连接弹幕服务器')
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接失败'
      updateStatus({
        status: 'error',
        statusText: message,
        lastError: message,
      })
      ElMessage.error(message)
    } finally {
      isConnecting.value = false
    }
  }

  function disconnect(showToast = true): void {
    client?.disconnect()
    client = null

    updateStatus({
      status: 'disconnected',
      statusText: '连接已断开',
      currentHost: '--',
    })

    if (showToast) {
      ElMessage.info('已断开连接')
    }
  }

  async function updateConfig(partial: Partial<DanmuConfig>): Promise<void> {
    config.value = {
      ...config.value,
      ...partial,
    }
    status.value.roomId = config.value.roomId
    await persistConfig()
  }

  function clearMessages(): void {
    messages.value = []
    addSystemMessage('已清空弹幕列表')
  }

  return {
    config,
    groupedStatus,
    initialized,
    isConnecting,
    logs,
    messages,
    status,
    clearMessages,
    connect,
    disconnect,
    initialize,
    updateConfig,
  }
})
