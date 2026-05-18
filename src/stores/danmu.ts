import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'

import { resolveRoomId } from '../api/bilibili'
import type { DanmuConfig, DanmuMessageItem, StatusSnapshot } from '../types/danmu'
import type { ConnectionStatus, ReconnectNotice } from '../types/danmu'
import type { LogRecord } from '../utils/logger'
import { loadConfig, saveConfig } from '../utils/persist'
import { LiveDanmuSocket } from '../websocket'
import { createSystemNotice } from '../websocket/events'
import { logError, logInfo, logSuccess, logWarning, onLog } from '../utils/logger'

const MAX_MESSAGE_LIMIT = 500

function createDefaultConfig(): DanmuConfig {
  return {
    roomId: '',
    reconnectInterval: 5,
    maxMessages: MAX_MESSAGE_LIMIT,
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
    messageCount: 0,
    autoScrollEnabled: true,
  }
}

export const useDanmuStore = defineStore('danmu', () => {
  const config = ref<DanmuConfig>(createDefaultConfig())
  const status = ref<StatusSnapshot>(createDefaultStatus())
  const messages = ref<DanmuMessageItem[]>([])
  const logs = ref<LogRecord[]>([])
  const initialized = ref(false)
  const connecting = ref(false)

  let socket: LiveDanmuSocket | null = null
  let lastStatus: ConnectionStatus = 'idle'
  let unlistenLog: (() => void) | null = null

  const canConnect = computed(() => Boolean(config.value.roomId.trim()) && !connecting.value)
  const isAutoScrollPaused = computed(() => !status.value.autoScrollEnabled)

  function bindLogger(): void {
    if (unlistenLog) {
      return
    }

    unlistenLog = onLog((record) => {
      logs.value.unshift(record)
      logs.value = logs.value.slice(0, 100)
    })
  }

  function clampMaxMessages(limit: number): number {
    return Math.max(100, Math.min(MAX_MESSAGE_LIMIT, limit))
  }

  function addMessage(message: DanmuMessageItem): void {
    messages.value.push(message)

    if (messages.value.length > config.value.maxMessages) {
      messages.value.splice(0, messages.value.length - config.value.maxMessages)
    }

    status.value.messageCount = messages.value.length
  }

  function addSystemNotice(
    content: string,
    tone: 'soft' | 'normal' | 'warning' | 'error' = 'normal',
    rawCommand = 'SYSTEM',
  ): void {
    addMessage(createSystemNotice(content, tone, rawCommand))
  }

  function updateStatus(payload: Partial<StatusSnapshot>): void {
    status.value = {
      ...status.value,
      ...payload,
    }
  }

  function notifyStatusTransition(nextStatus: ConnectionStatus, statusText: string, error?: string): void {
    if (nextStatus === lastStatus) {
      return
    }

    if (nextStatus === 'connected') {
      ElMessage.success('连接成功')
    } else if (nextStatus === 'disconnected' && lastStatus !== 'idle') {
      ElMessage.info('WebSocket 已断开')
    } else if (nextStatus === 'error') {
      ElMessage.error(error || statusText || '连接异常')
    }

    lastStatus = nextStatus
  }

  async function initialize(): Promise<void> {
    if (initialized.value) {
      return
    }

    bindLogger()
    config.value = await loadConfig()
    config.value.maxMessages = clampMaxMessages(config.value.maxMessages)
    status.value.roomId = config.value.roomId
    initialized.value = true
    logInfo('store', '配置初始化完成')
  }

  async function updateConfig(partial: Partial<DanmuConfig>): Promise<void> {
    config.value = {
      ...config.value,
      ...partial,
      maxMessages: clampMaxMessages(partial.maxMessages ?? config.value.maxMessages),
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
      messageCount: messages.value.length,
    })
    lastStatus = 'connecting'

    try {
      const resolvedRoomId = await resolveRoomId(inputRoomId)
      updateStatus({
        resolvedRoomId,
        statusText: '真实房间号解析成功',
      })
      addSystemNotice(`已解析真实房间号：${resolvedRoomId}`, 'soft', 'ROOM_RESOLVED')
      logInfo('connection', `真实房间号解析成功: ${resolvedRoomId}`)

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
          notifyStatusTransition(nextStatus, statusText, error)
        },
        onPopularity: (popularity) => {
          updateStatus({ popularity })
        },
        onMessage: (message) => {
          console.log(`[LiveDanmu][${message.rawCommand}]`, message.summary)
          addMessage(message)
        },
        onRawCommand: (payload) => {
          console.debug('[LiveDanmu][RAW]', payload.cmd ?? 'UNKNOWN', payload)
        },
        onReconnectScheduled: (notice: ReconnectNotice) => {
          handleReconnectNotice(notice)
        },
      })

      await saveConfig(config.value)
      await socket.connect()
      logSuccess('connection', `已连接到直播间 ${resolvedRoomId}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接失败'
      updateStatus({
        status: 'error',
        statusText: message,
        websocketState: 'CLOSED',
        lastError: message,
      })
      addSystemNotice(`连接失败：${message}`, 'error', 'CONNECT_ERROR')
      logError('connection', message)
      ElMessage.error('连接失败')
      lastStatus = 'error'
    } finally {
      connecting.value = false
    }
  }

  function handleReconnectNotice(notice: ReconnectNotice): void {
    addSystemNotice(
      `${notice.reason}，${notice.reconnectInSeconds} 秒后开始第 ${notice.reconnectCount} 次重连`,
      'warning',
      'RECONNECT',
    )
    logWarning('websocket', `${notice.reason}，${notice.reconnectInSeconds} 秒后自动重连`)
    ElMessage.warning('WebSocket 断开，正在自动重连')
  }

  function disconnect(showToast = true): void {
    const hadSocket = Boolean(socket)
    socket?.disconnect()
    socket = null
    updateStatus({
      status: 'disconnected',
      statusText: '连接已断开',
      websocketState: 'CLOSED',
      reconnectCount: 0,
    })
    if (showToast && hadSocket) {
      ElMessage.info('WebSocket 已断开')
    }
    if (hadSocket) {
      logInfo('connection', '用户手动断开连接')
    }
    lastStatus = 'disconnected'
  }

  function clearMessages(): void {
    messages.value = []
    status.value.messageCount = 0
    addSystemNotice('已清空弹幕列表', 'soft', 'CLEAR_MESSAGES')
  }

  function setAutoScrollEnabled(enabled: boolean): void {
    status.value.autoScrollEnabled = enabled
  }

  return {
    canConnect,
    config,
    connecting,
    initialized,
    isAutoScrollPaused,
    logs,
    messages,
    status,
    clearMessages,
    connect,
    disconnect,
    initialize,
    setAutoScrollEnabled,
    updateConfig,
  }
})
