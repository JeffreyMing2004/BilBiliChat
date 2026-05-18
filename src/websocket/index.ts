import type { AuthReplyPayload, DanmuMessageItem, RawDanmuCommand, ReconnectNotice } from '../types/websocket'
import { logError, logInfo, logSuccess, logWarning } from '../utils/logger'
import { decodePacketFrames } from './decoder'
import { createHeartbeatPacket, HEARTBEAT_INTERVAL_MS } from './heartbeat'
import {
  BILIBILI_WEBSOCKET_URL,
  createAuthPacket,
  decodeTextBody,
  PacketOperation,
  readPopularity,
} from './packet'
import type { PacketFrame } from './packet'
import { parseCommandBody, parseDanmuEvent } from './events'

export type LiveSocketStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'

interface LiveDanmuSocketOptions {
  roomId: number
  reconnectInterval: number
  autoReconnect: boolean
  onStatus: (payload: {
    status: LiveSocketStatus
    statusText: string
    websocketState: string
    reconnectCount: number
    error?: string
  }) => void
  onPopularity: (popularity: number) => void
  onLatency?: (latency: number) => void
  onMessage: (message: DanmuMessageItem) => void
  onRawCommand?: (payload: RawDanmuCommand) => void
  onReconnectScheduled?: (notice: ReconnectNotice) => void
}

function readyStateText(socket: WebSocket | null): string {
  if (!socket) {
    return 'CLOSED'
  }

  switch (socket.readyState) {
    case WebSocket.CONNECTING:
      return 'CONNECTING'
    case WebSocket.OPEN:
      return 'OPEN'
    case WebSocket.CLOSING:
      return 'CLOSING'
    default:
      return 'CLOSED'
  }
}

export class LiveDanmuSocket {
  private readonly options: LiveDanmuSocketOptions
  private socket: WebSocket | null = null
  private heartbeatTimer: number | null = null
  private reconnectTimer: number | null = null
  private authTimeoutTimer: number | null = null
  private reconnectCount = 0
  private isManualClose = false
  private isAuthenticated = false
  private lastHeartbeatAt = 0
  private connectResolve: (() => void) | null = null
  private connectReject: ((error: Error) => void) | null = null

  constructor(options: LiveDanmuSocketOptions) {
    this.options = options
  }

  connect(): Promise<void> {
    this.isManualClose = false
    this.clearReconnectTimer()
    this.clearAuthTimeoutTimer()

    return new Promise((resolve, reject) => {
      this.connectResolve = resolve
      this.connectReject = reject
      this.openSocket(this.reconnectCount > 0 ? 'reconnecting' : 'connecting')
    })
  }

  disconnect(): void {
    this.isManualClose = true
    this.isAuthenticated = false
    this.clearHeartbeatTimer()
    this.clearReconnectTimer()
    this.clearAuthTimeoutTimer()

    if (this.socket) {
      this.socket.close(1000, 'manual-close')
      this.socket = null
    }

    logInfo('websocket', '连接已手动断开')
    this.emitStatus('disconnected', '已断开连接')
  }

  private openSocket(status: 'connecting' | 'reconnecting'): void {
    this.isAuthenticated = false
    this.socket = new WebSocket(BILIBILI_WEBSOCKET_URL)
    this.socket.binaryType = 'arraybuffer'

    logInfo('connection', `开始连接直播间 ${this.options.roomId}`)
    this.emitStatus(
      status,
      status === 'reconnecting' ? `正在重连，第 ${this.reconnectCount} 次` : '正在连接 WebSocket',
    )

    this.socket.onopen = () => {
      if (!this.socket) {
        return
      }

      this.socket.send(createAuthPacket(this.options.roomId))
      logInfo('websocket', 'WebSocket 已连接，认证包已发送')
      this.emitStatus(status, 'WebSocket 已连接，正在发送认证包')
      this.startAuthTimeout()
    }

    this.socket.onmessage = async (event) => {
      const buffer = event.data as ArrayBuffer
      const frames = await decodePacketFrames(buffer)

      for (const frame of frames) {
        await this.handleFrame(frame)
      }
    }

    this.socket.onerror = () => {
      logError('websocket', 'WebSocket 连接异常')
      this.emitStatus('error', 'WebSocket 连接异常', 'WebSocket 连接异常')
    }

    this.socket.onclose = () => {
      this.clearHeartbeatTimer()
      this.clearAuthTimeoutTimer()
      this.socket = null

      if (this.isManualClose) {
        return
      }

      logWarning('websocket', '连接断开')
      this.rejectPendingConnect('连接已关闭')

      if (!this.options.autoReconnect) {
        this.emitStatus('disconnected', '连接断开，自动重连已关闭')
        return
      }

      this.scheduleReconnect('连接断开，准备自动重连')
    }
  }

  private async handleFrame(frame: PacketFrame): Promise<void> {
    switch (frame.header.operation) {
      case PacketOperation.AuthReply:
        this.handleAuthReply(frame)
        break
      case PacketOperation.HeartbeatReply:
        this.options.onPopularity(readPopularity(frame.body))
        if (this.lastHeartbeatAt > 0) {
          this.options.onLatency?.(Math.round(performance.now() - this.lastHeartbeatAt))
        }
        break
      case PacketOperation.Message:
        await this.handleMessageFrame(frame)
        break
      default:
        break
    }
  }

  private handleAuthReply(frame: PacketFrame): void {
    const text = decodeTextBody(frame.body)
    let payload: AuthReplyPayload = { code: 0 }

    if (text) {
      try {
        payload = JSON.parse(text) as AuthReplyPayload
      } catch {
        payload = { code: 0 }
      }
    }

    if (payload.code && payload.code !== 0) {
      const error = `认证失败，返回码 ${payload.code}`
      logError('connection', error)
      this.rejectPendingConnect(error)
      this.emitStatus('error', error, error)
      return
    }

    this.isAuthenticated = true
    this.reconnectCount = 0
    this.clearAuthTimeoutTimer()
    this.startHeartbeat()
    logSuccess('connection', '认证成功，开始接收弹幕')
    this.emitStatus('connected', '认证成功，开始接收弹幕')

    if (this.connectResolve) {
      this.connectResolve()
      this.connectResolve = null
      this.connectReject = null
    }
  }

  private async handleMessageFrame(frame: PacketFrame): Promise<void> {
    const payloads = parseCommandBody(frame.body)

    payloads.forEach((payload) => {
      this.options.onRawCommand?.(payload)
      const message = parseDanmuEvent(payload)

      if (message) {
        this.options.onMessage(message)
      }
    })
  }

  private startHeartbeat(): void {
    this.clearHeartbeatTimer()

    this.heartbeatTimer = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.lastHeartbeatAt = performance.now()
        this.socket.send(createHeartbeatPacket())
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  private startAuthTimeout(): void {
    this.clearAuthTimeoutTimer()
    this.authTimeoutTimer = window.setTimeout(() => {
      if (!this.isAuthenticated) {
        const error = '认证超时'
        logError('connection', error)
        this.rejectPendingConnect(error)
        this.emitStatus('error', error, error)
        this.socket?.close()
      }
    }, 10_000)
  }

  private scheduleReconnect(reason: string): void {
    this.clearReconnectTimer()
    this.reconnectCount += 1
    this.emitStatus('reconnecting', reason)
    this.options.onReconnectScheduled?.({
      reconnectCount: this.reconnectCount,
      reconnectInSeconds: this.options.reconnectInterval,
      reason,
    })

    this.reconnectTimer = window.setTimeout(() => {
      this.openSocket('reconnecting')
    }, this.options.reconnectInterval * 1000)
  }

  private emitStatus(status: LiveSocketStatus, statusText: string, error?: string): void {
    this.options.onStatus({
      status,
      statusText,
      websocketState: readyStateText(this.socket),
      reconnectCount: this.reconnectCount,
      error,
    })
  }

  private rejectPendingConnect(message: string): void {
    if (this.connectReject) {
      this.connectReject(new Error(message))
      this.connectResolve = null
      this.connectReject = null
    }
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

  private clearAuthTimeoutTimer(): void {
    if (this.authTimeoutTimer !== null) {
      window.clearTimeout(this.authTimeoutTimer)
      this.authTimeoutTimer = null
    }
  }
}
