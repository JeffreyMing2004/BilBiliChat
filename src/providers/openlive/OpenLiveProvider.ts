import { createSystemNotice } from '../../core/message/MessageFactory'
import { logDebug, logError, logInfo, logWarn } from '../../core/logger/Logger'
import type { LiveProvider, LiveProviderOptions, LiveProviderRoomInfo } from '../../core/live/LiveProvider'
import type { LiveMessage, SCMessage, GiftMessage, DanmuMessage, SystemMessage } from '../../types/message'
import { colorFromText } from '../../utils/color'
import { formatTime } from '../../utils/time'
import { decodePacketFrames } from '../../websocket/decoder'
import { createPacket, decodeTextBody, PacketOperation, PacketVersion, readPopularity } from '../../websocket/packet'

interface OpenLiveRuntimeConfig {
  appId: number
  accessKeyId: string
  accessKeySecret: string
  apiBase: string
}

interface OpenLiveApiEnvelope<T> {
  code: number
  message?: string
  msg?: string
  request_id?: string
  data?: T
}

interface OpenLiveAnchorInfo {
  room_id: number
  uname: string
  uface: string
  uid: number
}

interface OpenLiveGameInfo {
  game_id: string
}

interface OpenLiveWebsocketInfo {
  auth_body: string | Record<string, unknown>
  wss_link?: string[]
  ws_link?: string[]
}

interface OpenLiveStartData {
  anchor_info: OpenLiveAnchorInfo
  game_info: OpenLiveGameInfo
  websocket_info: OpenLiveWebsocketInfo
}

interface OpenLiveCommandPayload {
  cmd?: string
  data?: Record<string, unknown>
}

const OPEN_LIVE_BASE_URL = 'https://live-open.biliapi.com'
const OPEN_LIVE_HEARTBEAT_INTERVAL_MS = 20_000
const OPEN_LIVE_AUTH_TIMEOUT_MS = 10_000

function createBaseMessage() {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: formatTime(),
    createdAt: Date.now(),
  }
}

function pickRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value ? value as Record<string, unknown> : {}
}

function getOpenLiveConfig(): OpenLiveRuntimeConfig {
  return {
    appId: Number(import.meta.env.VITE_BILIBILI_OPENLIVE_APP_ID ?? 0),
    accessKeyId: import.meta.env.VITE_BILIBILI_OPENLIVE_ACCESS_KEY_ID ?? '',
    accessKeySecret: import.meta.env.VITE_BILIBILI_OPENLIVE_ACCESS_KEY_SECRET ?? '',
    apiBase: import.meta.env.VITE_BILIBILI_OPENLIVE_API_BASE ?? OPEN_LIVE_BASE_URL,
  }
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

function textToUint8Array(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0
}

function md5Hex(text: string): string {
  const input = textToUint8Array(text)
  const originalBitLength = input.length * 8
  const withPaddingLength = (((input.length + 8) >> 6) + 1) * 64
  const buffer = new Uint8Array(withPaddingLength)
  buffer.set(input)
  buffer[input.length] = 0x80

  const lengthView = new DataView(buffer.buffer)
  lengthView.setUint32(withPaddingLength - 8, originalBitLength >>> 0, true)
  lengthView.setUint32(withPaddingLength - 4, Math.floor(originalBitLength / 0x100000000), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  const shifts = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ]
  const table = Array.from({ length: 64 }, (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0)

  for (let offset = 0; offset < buffer.length; offset += 64) {
    const chunk = new Uint32Array(16)
    for (let index = 0; index < 16; index += 1) {
      chunk[index] = lengthView.getUint32(offset + index * 4, true)
    }

    let a = a0
    let b = b0
    let c = c0
    let d = d0

    for (let index = 0; index < 64; index += 1) {
      let f: number
      let g = index

      if (index < 16) {
        f = (b & c) | (~b & d)
      } else if (index < 32) {
        f = (d & b) | (~d & c)
        g = (5 * index + 1) % 16
      } else if (index < 48) {
        f = b ^ c ^ d
        g = (3 * index + 5) % 16
      } else {
        f = c ^ (b | ~d)
        g = (7 * index) % 16
      }

      const temp = d
      d = c
      c = b
      const next = (a + f + table[index] + chunk[g]) >>> 0
      b = (b + rotateLeft(next, shifts[index])) >>> 0
      a = temp
    }

    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }

  const digest = new Uint8Array(16)
  const digestView = new DataView(digest.buffer)
  digestView.setUint32(0, a0, true)
  digestView.setUint32(4, b0, true)
  digestView.setUint32(8, c0, true)
  digestView.setUint32(12, d0, true)
  return bytesToHex(digest)
}

async function hmacSha256Hex(secret: string, content: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(textToUint8Array(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, toArrayBuffer(textToUint8Array(content)))
  return bytesToHex(new Uint8Array(signature))
}

function buildSignaturePayload(headers: Record<string, string>): string {
  return Object.keys(headers)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => `${key}:${headers[key]}`)
    .join('\n')
}

async function createSignedHeaders(path: string, bodyText: string, config: OpenLiveRuntimeConfig): Promise<Record<string, string>> {
  const nonce = crypto.randomUUID()
  const timestamp = String(Math.floor(Date.now() / 1000))
  const xbiliHeaders = {
    'x-bili-accesskeyid': config.accessKeyId,
    'x-bili-content-md5': md5Hex(bodyText),
    'x-bili-signature-method': 'HMAC-SHA256',
    'x-bili-signature-nonce': nonce,
    'x-bili-signature-version': '1.0',
    'x-bili-timestamp': timestamp,
  }
  const authorization = await hmacSha256Hex(config.accessKeySecret, buildSignaturePayload(xbiliHeaders))

  logDebug('connection', `OpenLive sign ${path} nonce=${nonce}`)
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: authorization,
    ...xbiliHeaders,
  }
}

async function requestOpenLive<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const config = getOpenLiveConfig()
  const url = new URL(path, config.apiBase)
  const bodyText = JSON.stringify(body)
  const response = await fetch(url, {
    method: 'POST',
    headers: await createSignedHeaders(path, bodyText, config),
    body: bodyText,
  })

  const payload = await response.json() as OpenLiveApiEnvelope<T>
  if (!response.ok || payload.code !== 0 || !payload.data) {
    throw new Error(resolveOpenLiveError(payload.code, String(payload.message ?? payload.msg ?? 'OpenLive 请求失败')))
  }

  return payload.data
}

function resolveOpenLiveError(code: number, fallback: string): string {
  switch (code) {
    case 7001:
      return 'OpenLive 身份码无效或已过期'
    case 7002:
      return 'OpenLive 应用未授权直播场景'
    case 7003:
      return 'OpenLive 直播场次已存在，请稍后重试'
    case 7007:
      return 'OpenLive 场次不存在或已结束'
    case 7008:
      return 'OpenLive 心跳超时，场次已失效'
    case 7010:
      return 'OpenLive 访问频率过高，请稍后重试'
    default:
      return fallback
  }
}

function parseMessageList(text: string): OpenLiveCommandPayload[] {
  const content = text.trim()
  if (!content) {
    return []
  }

  try {
    const parsed = JSON.parse(content) as unknown
    if (Array.isArray(parsed)) {
      return parsed.map((item) => pickRecord(item) as OpenLiveCommandPayload)
    }

    return [pickRecord(parsed) as OpenLiveCommandPayload]
  } catch {
    return content
      .split(/(?<=\})(?=\{)/g)
      .map((item) => item.trim())
      .filter(Boolean)
      .flatMap((item) => {
        try {
          return [JSON.parse(item) as OpenLiveCommandPayload]
        } catch {
          return []
        }
      })
  }
}

function createDanmuMessage(username: string, content: string): DanmuMessage {
  return {
    ...createBaseMessage(),
    type: 'danmu',
    username,
    content,
    summary: `[${username}] ${content}`,
    userColor: colorFromText(username),
    rawCommand: 'LIVE_OPEN_PLATFORM_DM',
  }
}

function createGiftMessage(username: string, giftName: string, giftCount: number, price: number): GiftMessage {
  return {
    ...createBaseMessage(),
    type: 'gift',
    username,
    content: `${giftName} × ${giftCount}`,
    summary: `[${username}] 赠送了 ${giftName} × ${giftCount}`,
    userColor: '#ffb75e',
    giftName,
    giftCount,
    giftType: price > 0 ? '付费礼物' : '免费礼物',
    price,
    rawCommand: 'LIVE_OPEN_PLATFORM_SEND_GIFT',
  }
}

function createSuperChatMessage(username: string, content: string, price: number): SCMessage {
  return {
    ...createBaseMessage(),
    type: 'superChat',
    username,
    content,
    summary: `[${username}] ￥${price}\n${content}`,
    userColor: '#ffffff',
    price,
    priceColor: price >= 100 ? '#ff7a45' : '#13c2c2',
    rawCommand: 'LIVE_OPEN_PLATFORM_SUPER_CHAT',
  }
}

function createSystemMessage(content: string, tone: SystemMessage['tone'], rawCommand: string): SystemMessage {
  return {
    ...createBaseMessage(),
    type: 'system',
    username: '系统',
    content,
    summary: content,
    systemKind: 'notice',
    tone,
    rawCommand,
  }
}

function normalizeOpenLiveMessage(payload: OpenLiveCommandPayload): LiveMessage | null {
  const command = payload.cmd ?? ''
  const data = pickRecord(payload.data)
  const username = String(data.uname ?? data.username ?? '观众')

  switch (command) {
    case 'LIVE_OPEN_PLATFORM_DM':
      return createDanmuMessage(username, String(data.msg ?? ''))
    case 'LIVE_OPEN_PLATFORM_SEND_GIFT':
      return createGiftMessage(
        username,
        String(data.giftName ?? '礼物'),
        Number(data.giftNum ?? 1),
        Number(data.price ?? 0),
      )
    case 'LIVE_OPEN_PLATFORM_SUPER_CHAT':
      return createSuperChatMessage(
        username,
        String(data.message ?? '发送了一条醒目留言'),
        Number(data.rmb ?? data.price ?? 0),
      )
    case 'LIVE_OPEN_PLATFORM_ENTER_ROOM':
      return createSystemNotice(`${username} 进入直播间`, 'soft', command)
    case 'LIVE_OPEN_PLATFORM_LIKE':
      return createSystemMessage(`${username} 点赞了直播间`, 'soft', command)
    case 'LIVE_OPEN_PLATFORM_GUARD':
      return createSystemMessage(
        `${username} 开通了 ${String(data.guardUnit ?? '大航海')} × ${Number(data.guardNum ?? 1)}`,
        'normal',
        command,
      )
    case 'LIVE_OPEN_PLATFORM_LIVE':
      return createSystemMessage(
        `主播已开播：${String(data.title ?? '直播已开始')}`,
        'normal',
        command,
      )
    case 'LIVE_OPEN_PLATFORM_LIVE_OFF':
      return createSystemMessage('主播已下播，等待下一场直播', 'warning', command)
    case 'LIVE_OPEN_PLATFORM_INTERACTION_END':
    case 'LIVE_OPEN_PLATFORM_GAME_END':
      return createSystemMessage('OpenLive 场次已结束', 'warning', command)
    case 'LIVE_OPEN_PLATFORM_GAME_START':
      return createSystemMessage(`OpenLive 场次已建立：${String(data.gameId ?? '')}`, 'soft', command)
    default:
      return null
  }
}

export class OpenLiveProvider implements LiveProvider {
  readonly kind = 'open-live' as const

  private readonly options: LiveProviderOptions
  private socket: WebSocket | null = null
  private heartbeatTimer: number | null = null
  private reconnectTimer: number | null = null
  private authTimeoutTimer: number | null = null
  private connected = false
  private manualClose = false
  private reconnectCount = 0
  private connectResolve: (() => void) | null = null
  private connectReject: ((error: Error) => void) | null = null
  private lastHeartbeatAt = 0
  private gameId = ''
  private anchorInfo: OpenLiveAnchorInfo | null = null
  private websocketInfo: OpenLiveWebsocketInfo | null = null

  constructor(options: LiveProviderOptions) {
    this.options = options
  }

  connect(): Promise<void> {
    this.manualClose = false
    this.clearReconnectTimer()

    return new Promise((resolve, reject) => {
      this.connectResolve = resolve
      this.connectReject = reject
      void this.startAndConnect(this.reconnectCount > 0 ? 'reconnecting' : 'connecting')
    })
  }

  async disconnect(): Promise<void> {
    this.manualClose = true
    this.connected = false
    this.clearHeartbeatTimer()
    this.clearReconnectTimer()
    this.clearAuthTimeoutTimer()

    if (this.socket) {
      this.socket.close(1000, 'manual-close')
      this.socket = null
    }

    const gameId = this.gameId
    this.gameId = ''
    this.websocketInfo = null

    if (gameId) {
      try {
        await requestOpenLive('/v2/app/end', {
          app_id: getOpenLiveConfig().appId,
          game_id: gameId,
        })
      } catch (error) {
        logWarn('connection', error instanceof Error ? error.message : 'OpenLive 场次关闭失败')
      }
    }

    this.options.onStatus({
      status: 'disconnected',
      statusText: 'OpenLive 已断开',
      websocketState: 'CLOSED',
      reconnectCount: this.reconnectCount,
    })
  }

  sendHeartbeat(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.lastHeartbeatAt = performance.now()
      this.socket.send(createPacket(PacketOperation.Heartbeat, new Uint8Array(), PacketVersion.Heartbeat))
    }

    if (this.gameId) {
      void this.sendHttpHeartbeat()
    }
  }

  async getRoomInfo(): Promise<LiveProviderRoomInfo> {
    return {
      kind: this.kind,
      roomId: this.anchorInfo?.room_id ?? this.options.roomId,
      displayName: this.anchorInfo?.uname || 'Bilibili OpenLive',
      connected: this.connected,
    }
  }

  private async startAndConnect(status: 'connecting' | 'reconnecting'): Promise<void> {
    try {
      const config = getOpenLiveConfig()
      const identityCode = this.options.openLiveIdentityCode?.trim()
      if (!config.appId || !config.accessKeyId || !config.accessKeySecret) {
        throw new Error('未配置 OpenLive AppId / AccessKey，请检查环境变量')
      }
      if (!identityCode) {
        throw new Error('请先在设置中填写 OpenLive 官方身份码')
      }

      this.options.onStatus({
        status,
        statusText: status === 'reconnecting' ? '正在重建 OpenLive 场次' : '正在启动 OpenLive 场次',
        websocketState: readyStateText(this.socket),
        reconnectCount: this.reconnectCount,
      })

      const data = await requestOpenLive<OpenLiveStartData>('/v2/app/start', {
        code: identityCode,
        app_id: config.appId,
      })

      this.anchorInfo = data.anchor_info
      this.gameId = data.game_info.game_id
      this.websocketInfo = data.websocket_info
      await this.openWebSocket(status)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OpenLive 启动失败'
      logError('connection', message)
      this.rejectPendingConnect(message)
      this.options.onStatus({
        status: 'error',
        statusText: message,
        websocketState: readyStateText(this.socket),
        reconnectCount: this.reconnectCount,
        error: message,
      })
      if (!this.manualClose && this.options.autoReconnect) {
        this.scheduleReconnect(message)
      }
    }
  }

  private async openWebSocket(status: 'connecting' | 'reconnecting'): Promise<void> {
    const links = this.websocketInfo?.wss_link ?? this.websocketInfo?.ws_link ?? []
    const url = links.find(Boolean)
    if (!url || !this.websocketInfo) {
      throw new Error('OpenLive 未返回可用的 WebSocket 地址')
    }

    this.socket = new WebSocket(url)
    this.socket.binaryType = 'arraybuffer'
    this.options.onStatus({
      status,
      statusText: 'OpenLive WebSocket 正在建立连接',
      websocketState: readyStateText(this.socket),
      reconnectCount: this.reconnectCount,
    })

    this.socket.onopen = () => {
      if (!this.socket || !this.websocketInfo) {
        return
      }

      const authBody = typeof this.websocketInfo.auth_body === 'string'
        ? this.websocketInfo.auth_body
        : JSON.stringify(this.websocketInfo.auth_body)
      this.socket.send(createPacket(PacketOperation.Auth, authBody, PacketVersion.Heartbeat))
      this.startAuthTimeout()
      logInfo('connection', `OpenLive WebSocket 已连接，房间 ${this.anchorInfo?.room_id ?? this.options.roomId}`)
    }

    this.socket.onmessage = async (event) => {
      try {
        const frames = await decodePacketFrames(event.data as ArrayBuffer)
        for (const frame of frames) {
          await this.handleFrame(frame.header.operation, frame.body)
        }
      } catch (error) {
        logWarn('connection', error instanceof Error ? error.message : 'OpenLive 消息解析失败')
      }
    }

    this.socket.onerror = () => {
      const message = 'OpenLive WebSocket 连接异常'
      logWarn('connection', message)
      this.options.onStatus({
        status: 'error',
        statusText: message,
        websocketState: readyStateText(this.socket),
        reconnectCount: this.reconnectCount,
        error: message,
      })
    }

    this.socket.onclose = () => {
      this.connected = false
      this.clearHeartbeatTimer()
      this.clearAuthTimeoutTimer()
      this.socket = null

      if (this.manualClose) {
        return
      }

      const reason = 'OpenLive 连接已断开'
      this.rejectPendingConnect(reason)
      if (!this.options.autoReconnect) {
        this.options.onStatus({
          status: 'disconnected',
          statusText: reason,
          websocketState: 'CLOSED',
          reconnectCount: this.reconnectCount,
        })
        return
      }

      this.scheduleReconnect(reason)
    }
  }

  private async handleFrame(operation: number, body: Uint8Array): Promise<void> {
    if (operation === PacketOperation.AuthReply) {
      const payload = pickRecord(JSON.parse(decodeTextBody(body) || '{}'))
      const code = Number(payload.code ?? 0)
      if (code !== 0) {
        throw new Error(resolveOpenLiveError(code, `OpenLive 认证失败，返回码 ${code}`))
      }

      this.connected = true
      this.reconnectCount = 0
      this.clearAuthTimeoutTimer()
      this.startHeartbeat()
      this.options.onStatus({
        status: 'connected',
        statusText: `OpenLive 已连接 ${this.anchorInfo?.uname ?? ''}`.trim(),
        websocketState: readyStateText(this.socket),
        reconnectCount: this.reconnectCount,
      })
      this.resolvePendingConnect()
      return
    }

    if (operation === PacketOperation.HeartbeatReply) {
      this.options.onPopularity(readPopularity(body))
      if (this.lastHeartbeatAt > 0) {
        this.options.onLatency?.(Math.round(performance.now() - this.lastHeartbeatAt))
      }
      return
    }

    if (operation !== PacketOperation.Message) {
      return
    }

    const text = decodeTextBody(body)
    parseMessageList(text).forEach((payload) => {
      const message = normalizeOpenLiveMessage(payload)
      if (message) {
        this.options.onMessage(message)
      } else if (payload.cmd) {
        logDebug('connection', `OpenLive 忽略事件 ${payload.cmd}`)
      }
    })
  }

  private startHeartbeat(): void {
    this.clearHeartbeatTimer()
    this.heartbeatTimer = window.setInterval(() => {
      this.sendHeartbeat()
    }, OPEN_LIVE_HEARTBEAT_INTERVAL_MS)
  }

  private startAuthTimeout(): void {
    this.clearAuthTimeoutTimer()
    this.authTimeoutTimer = window.setTimeout(() => {
      const message = 'OpenLive 认证超时'
      this.rejectPendingConnect(message)
      this.options.onStatus({
        status: 'error',
        statusText: message,
        websocketState: readyStateText(this.socket),
        reconnectCount: this.reconnectCount,
        error: message,
      })
      this.socket?.close()
    }, OPEN_LIVE_AUTH_TIMEOUT_MS)
  }

  private async sendHttpHeartbeat(): Promise<void> {
    if (!this.gameId) {
      return
    }

    try {
      await requestOpenLive('/v2/app/heartbeat', {
        game_id: this.gameId,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OpenLive 心跳失败'
      logWarn('connection', message)
    }
  }

  private scheduleReconnect(reason: string): void {
    this.clearReconnectTimer()
    this.reconnectCount += 1
    this.options.onReconnectScheduled?.({
      reconnectCount: this.reconnectCount,
      reconnectInSeconds: this.options.reconnectInterval,
      reason,
    })
    this.options.onStatus({
      status: 'reconnecting',
      statusText: `${reason}，${this.options.reconnectInterval} 秒后重连`,
      websocketState: readyStateText(this.socket),
      reconnectCount: this.reconnectCount,
      error: reason,
    })
    this.reconnectTimer = window.setTimeout(() => {
      void this.startAndConnect('reconnecting')
    }, this.options.reconnectInterval * 1000)
  }

  private resolvePendingConnect(): void {
    this.connectResolve?.()
    this.connectResolve = null
    this.connectReject = null
  }

  private rejectPendingConnect(message: string): void {
    this.connectReject?.(new Error(message))
    this.connectResolve = null
    this.connectReject = null
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
