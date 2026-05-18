import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'

import { resolveRoomId } from '../api/bilibili'
import type { DanmuConfig, DanmuMessageItem, StatusSnapshot } from '../types/danmu'
import { loadConfig, saveConfig } from '../utils/persist'
import { formatTime } from '../utils/time'
import { LiveDanmuSocket } from '../websocket'

function createDefaultConfig(): DanmuConfig {
  return {
    roomId: '',
    reconnectInterval: 5,
    maxMessages: 300,
  }
}

function createDefaultStatus(): StatusSnapshot {
  return {
    roomId: '',
    resolvedRoomId: null,
    status: 'idle',
    statusText: '等待连接',
    websocketState: 'CLOSED',
    popularity: 0,
    reconnectCount: 0,
    lastError: '',
  }
}

function createSystemMessage(content: string): DanmuMessageItem {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: 'system',
    username: '系统',
    content,
    summary: content,
    timestamp: formatTime(),
    rawCommand: 'SYSTEM',
  }
}

export const useDanmuStore = defineStore('danmu', () => {
  const config = ref<DanmuConfig>(createDefaultConfig())
  const status = ref<StatusSnapshot>(createDefaultStatus())
  const messages = ref<DanmuMessageItem[]>([])
  const initialized = ref(false)
  const connecting = ref(false)

  let socket: LiveDanmuSocket | null = null

  const canConnect = computed(() => Boolean(config.value.roomId.trim()) && !connecting.value)

  function addMessage(message: DanmuMessageItem): void {
    messages.value.push(message)

    if (messages.value.length > config.value.maxMessages) {
      messages.value.splice(0, messages.value.length - config.value.maxMessages)
    }
  }

  function updateStatus(payload: Partial<StatusSnapshot>): void {
    status.value = {
      ...status.value,
      ...payload,
    }
  }

  async function initialize(): Promise<void> {
    if (initialized.value) {
      return
    }

    config.value = await loadConfig()
    status.value.roomId = config.value.roomId
    initialized.value = true
  }

  async function updateConfig(partial: Partial<DanmuConfig>): Promise<void> {
    config.value = {
      ...config.value,
      ...partial,
    }
    status.value.roomId = config.value.roomId
    await saveConfig(config.value)
  }

  async function connect(): Promise<void> {
    const inputRoomId = config.value.roomId.trim()

    if (!inputRoomId) {
      ElMessage.warning('请输入直播间号')
      return
    }

    disconnect(false)
    connecting.value = true
    updateStatus({
      roomId: inputRoomId,
      status: 'connecting',
      statusText: '正在解析真实房间号',
      lastError: '',
      popularity: 0,
      reconnectCount: 0,
    })

    try {
      const resolvedRoomId = await resolveRoomId(inputRoomId)
      updateStatus({
        resolvedRoomId,
        statusText: '真实房间号解析成功',
      })
      addMessage(createSystemMessage(`已解析真实房间号：${resolvedRoomId}`))

      socket = new LiveDanmuSocket({
        roomId: resolvedRoomId,
        reconnectInterval: config.value.reconnectInterval,
        onStatus: ({ status: nextStatus, statusText, websocketState, reconnectCount, error }) => {
          updateStatus({
            status: nextStatus,
            statusText,
            websocketState,
            reconnectCount,
            lastError: error ?? '',
          })
        },
        onPopularity: (popularity) => {
          updateStatus({ popularity })
        },
        onMessage: (message) => {
          console.log(`[LiveDanmu][${message.rawCommand}]`, message.summary, message)
          addMessage(message)
        },
        onRawCommand: (payload) => {
          console.debug('[LiveDanmu][RAW]', payload.cmd ?? 'UNKNOWN', payload)
        },
      })

      await saveConfig(config.value)
      await socket.connect()
      ElMessage.success('已连接到 Bilibili 直播弹幕服务器')
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接失败'
      updateStatus({
        status: 'error',
        statusText: message,
        websocketState: 'CLOSED',
        lastError: message,
      })
      addMessage(createSystemMessage(`连接失败：${message}`))
      ElMessage.error(message)
    } finally {
      connecting.value = false
    }
  }

  function disconnect(showToast = true): void {
    socket?.disconnect()
    socket = null
    updateStatus({
      status: 'disconnected',
      statusText: '连接已断开',
      websocketState: 'CLOSED',
      reconnectCount: 0,
    })

    if (showToast) {
      ElMessage.info('已断开连接')
    }
  }

  function clearMessages(): void {
    messages.value = []
    addMessage(createSystemMessage('已清空弹幕列表'))
  }

  return {
    canConnect,
    config,
    connecting,
    initialized,
    messages,
    status,
    clearMessages,
    connect,
    disconnect,
    initialize,
    updateConfig,
  }
})
