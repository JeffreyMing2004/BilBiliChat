import type { DanmuMessageItem, DanmuServerConfig, LiveRoomInfo } from '../types/danmu'
import { fetchDanmuServerConfig, fetchRoomInfo, resolveRoomId } from '../api/bilibili'
import { emitLog } from '../utils/logger'
import { createAuthPacket, createHeartbeatPacket, parseCommandMessages, readPopularity } from './codec'
import { WS_OPERATION } from './constants'
import { parseDanmuPayload } from './parser'

type ClientStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'

interface DanmuClientOptions {
  roomId: string
  reconnectInterval: number
  onStatus: (payload: {
    status: ClientStatus
    statusText: string
    currentHost?: string
    error?: string
  }) => void
  onMessage: (message: DanmuMessageItem) => void
  onPopularity: (popularity: number) => void
  onRoomInfo: (roomInfo: LiveRoomInfo, resolvedRoomId: number) => void
}

export class BilibiliDanmuClient {
  private readonly options: DanmuClientOptions
  private websocket: WebSocket | null = null
  private heartbeatTimer: number | null = null
  private reconnectTimer: number | null = null
  private reconnectCount = 0
  private manualClose = false
  private serverConfig: DanmuServerConfig | null = null
  private resolvedRoomId: number | null = null
  private hostIndex = 0

  constructor(options: DanmuClientOptions) {
    this.options = options
  }

  getCurrentHost(): string {
    return this.serverConfig?.hostList[this.hostIndex]?.host ?? '--'
  }

  async connect(): Promise<void> {
    this.manualClose = false
    this.clearReconnectTimer()

    try {
      this.options.onStatus({
        status: 'connecting',
        statusText: '正在解析直播间信息',
      })

      this.resolvedRoomId = await resolveRoomId(this.options.roomId)
      const [roomInfo, serverConfig] = await Promise.all([
        fetchRoomInfo(this.resolvedRoomId),
        fetchDanmuServerConfig(this.resolvedRoomId),
      ])

      this.serverConfig = serverConfig
      this.hostIndex = 0
      this.options.onRoomInfo(roomInfo, this.resolvedRoomId)
      this.openSocket()
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接初始化失败'
      this.handleError(message)
      throw error
    }
  }

  disconnect(): void {
    this.manualClose = true
    this.clearHeartbeatTimer()
    this.clearReconnectTimer()

    if (this.websocket) {
      this.websocket.close(1000, 'manual-close')
      this.websocket = null
    }

    this.options.onStatus({
      status: 'disconnected',
      statusText: '连接已断开',
      currentHost: '--',
    })
  }

  private openSocket(): void {
    if (!this.serverConfig || this.serverConfig.hostList.length === 0 || this.resolvedRoomId === null) {
      this.handleError('无可用弹幕节点')
      return
    }

    const host = this.serverConfig.hostList[this.hostIndex]
    const url = `wss://${host.host}:${host.wssPort}/sub`

    this.options.onStatus({
      status: this.reconnectCount > 0 ? 'reconnecting' : 'connecting',
      statusText: this.reconnectCount > 0 ? `正在重连，第 ${this.reconnectCount} 次` : '正在连接弹幕服务器',
      currentHost: host.host,
    })

    this.websocket = new WebSocket(url)
    this.websocket.binaryType = 'arraybuffer'

    this.websocket.onopen = () => {
      if (!this.websocket || this.resolvedRoomId === null || !this.serverConfig) {
        return
      }

      this.websocket.send(createAuthPacket(this.resolvedRoomId, this.serverConfig.token))
      this.startHeartbeat()
      emitLog('success', `已连接弹幕节点 ${host.host}`)
    }

    this.websocket.onmessage = async (event) => {
      const buffer = event.data as ArrayBuffer
      const view = new DataView(buffer)
      const operation = view.getUint32(8)

      if (operation === WS_OPERATION.connectSuccess) {
        this.reconnectCount = 0
        this.options.onStatus({
          status: 'connected',
          statusText: '弹幕服务器已连接',
          currentHost: host.host,
        })
        return
      }

      if (operation === WS_OPERATION.heartbeatReply) {
        this.options.onPopularity(readPopularity(buffer))
        return
      }

      if (operation !== WS_OPERATION.message) {
        return
      }

      const payloads = await parseCommandMessages(buffer)

      payloads.forEach(({ payload }) => {
        const message = parseDanmuPayload(payload)

        if (message) {
          this.options.onMessage(message)
        }
      })
    }

    this.websocket.onerror = () => {
      this.handleError('WebSocket 连接异常')
    }

    this.websocket.onclose = () => {
      this.clearHeartbeatTimer()
      this.websocket = null

      if (this.manualClose) {
        return
      }

      this.scheduleReconnect('连接已断开，准备自动重连')
    }
  }

  private startHeartbeat(): void {
    this.clearHeartbeatTimer()

    this.heartbeatTimer = window.setInterval(() => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        this.websocket.send(createHeartbeatPacket())
      }
    }, 30_000)
  }

  private scheduleReconnect(reason: string): void {
    this.clearReconnectTimer()
    this.reconnectCount += 1

    if (this.serverConfig && this.serverConfig.hostList.length > 0) {
      this.hostIndex = (this.hostIndex + 1) % this.serverConfig.hostList.length
    }

    this.options.onStatus({
      status: 'reconnecting',
      statusText: reason,
      currentHost: this.getCurrentHost(),
    })

    emitLog('warning', `${reason}，${this.options.reconnectInterval} 秒后重试`)

    this.reconnectTimer = window.setTimeout(() => {
      this.openSocket()
    }, this.options.reconnectInterval * 1000)
  }

  private handleError(message: string): void {
    emitLog('error', message)
    this.options.onStatus({
      status: 'error',
      statusText: message,
      error: message,
      currentHost: this.getCurrentHost(),
    })
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}
