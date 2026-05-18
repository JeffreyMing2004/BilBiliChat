import { createSystemNotice } from '../../core/message/MessageFactory'
import { logDebug, logError, logInfo, logWarn } from '../../core/logger/Logger'
import type { LiveProvider, LiveProviderOptions, LiveProviderRoomInfo, LiveProviderStatusPayload } from '../../core/live/LiveProvider'
import type { OpenLiveDebugRecord, OpenLiveStateSnapshot } from '../../types/openlive'
import type { RawDanmuCommand } from '../../types/websocket'
import { parseOpenLiveCommand } from './parser'
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

class OpenLiveProviderError extends Error {
  readonly code?: number
  readonly retryable: boolean
  readonly fallbackSuggested: boolean

  constructor(message: string, options: { code?: number; retryable?: boolean; fallbackSuggested?: boolean } = {}) {
    super(message)
    this.name = 'OpenLiveProviderError'
    this.code = options.code
    this.retryable = options.retryable ?? false
    this.fallbackSuggested = options.fallbackSuggested ?? false
  }
}

const OPEN_LIVE_BASE_URL = 'https://live-open.biliapi.com'
const OPEN_LIVE_HEARTBEAT_INTERVAL_MS = 20_000
const OPEN_LIVE_AUTH_TIMEOUT_MS = 10_000
const OPEN_LIVE_MAX_RECONNECT = 12
const OPEN_LIVE_MAX_RECONNECT_INTERVAL_MS = 30_000

function pickRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value ? value as Record<string, unknown> : {}
}

function pickNumber(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return 0
}

function validateIdentityCode(code: string): boolean {
  return code.trim().length >= 8
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

function getOpenLiveConfig(): OpenLiveRuntimeConfig {
  return {
    appId: Number(import.meta.env.VITE_BILIBILI_OPENLIVE_APP_ID ?? 0),
    accessKeyId: import.meta.env.VITE_BILIBILI_OPENLIVE_ACCESS_KEY_ID ?? '',
    accessKeySecret: import.meta.env.VITE_BILIBILI_OPENLIVE_ACCESS_KEY_SECRET ?? '',
    apiBase: import.meta.env.VITE_BILIBILI_OPENLIVE_API_BASE ?? OPEN_LIVE_BASE_URL,
  }
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

function resolveOpenLiveError(code: number, fallback: string): OpenLiveProviderError {
  switch (code) {
    case 7001:
      return new OpenLiveProviderError('OpenLive 身份码无效或已过期', {
        code,
        fallbackSuggested: true,
      })
    case 7002:
      return new OpenLiveProviderError('OpenLive 应用未授权直播场景', {
        code,
        fallbackSuggested: true,
      })
    case 7003:
      return new OpenLiveProviderError('OpenLive 直播场次已存在，请稍后重试', {
        code,
        retryable: true,
      })
    case 7007:
      return new OpenLiveProviderError('OpenLive 场次不存在或已结束', {
        code,
        retryable: true,
        fallbackSuggested: true,
      })
    case 7008:
      return new OpenLiveProviderError('OpenLive 心跳超时，场次已失效', {
        code,
        retryable: true,
        fallbackSuggested: true,
      })
    case 7010:
      return new OpenLiveProviderError('OpenLive 访问频率过高，请稍后重试', {
        code,
        retryable: true,
      })
    default:
      return new OpenLiveProviderError(fallback, { code })
  }
}

function normalizeOpenLiveError(error: unknown, fallback = 'OpenLive 连接失败'): OpenLiveProviderError {
  if (error instanceof OpenLiveProviderError) {
    return error
  }

  if (error instanceof Error) {
    return new OpenLiveProviderError(error.message || fallback)
  }

  return new OpenLiveProviderError(fallback)
}

async function requestOpenLive<T>(
  path: string,
  body: Record<string, unknown>,
  options: { allowEmptyData?: boolean } = {},
): Promise<T> {
  const config = getOpenLiveConfig()
  const url = new URL(path, config.apiBase)
  const bodyText = JSON.stringify(body)
  const response = await fetch(url, {
    method: 'POST',
    headers: await createSignedHeaders(path, bodyText, config),
    body: bodyText,
  })

  const payload = await response.json() as OpenLiveApiEnvelope<T>
  if (!response.ok || payload.code !== 0 || (!payload.data && !options.allowEmptyData)) {
    throw resolveOpenLiveError(payload.code, String(payload.message ?? payload.msg ?? 'OpenLive 请求失败'))
  }

  return payload.data as T
}

function parseMessageList(text: string): RawDanmuCommand[] {
  const content = text.trim()
  if (!content) {
    return []
  }

  try {
    const parsed = JSON.parse(content) as unknown
    if (Array.isArray(parsed)) {
      return parsed.map((item) => pickRecord(item) as RawDanmuCommand)
    }

    return [pickRecord(parsed) as RawDanmuCommand]
  } catch {
    return content
      .split(/(?<=\})(?=\{)/g)
      .map((item) => item.trim())
      .filter(Boolean)
      .flatMap((item) => {
        try {
          return [JSON.parse(item) as RawDanmuCommand]
        } catch {
          return []
        }
      })
  }
}

function parseTokenExpiresAt(authBody: string | Record<string, unknown>): number {
  const payload = typeof authBody === 'string'
    ? pickRecord((() => {
      try {
        return JSON.parse(authBody) as unknown
      } catch {
        return {}
      }
    })())
    : authBody

  const expiresIn = pickNumber(payload.expires_in, payload.token_expires_in, payload.expire_in)
  if (expiresIn > 0) {
    return Date.now() + expiresIn * 1000
  }

  const expireAt = pickNumber(payload.expire_at, payload.expires_at, payload.token_expire_at)
  if (expireAt > 0) {
    return expireAt > 1_000_000_000_000 ? expireAt : expireAt * 1000
  }

  return 0
}

function createInitialState(options: LiveProviderOptions): OpenLiveStateSnapshot {
  const identityCode = options.openLiveIdentityCode?.trim() ?? ''
  return {
    roomKey: options.roomKey,
    roomId: options.roomId,
    identityCode,
    identityCodeValid: validateIdentityCode(identityCode),
    authStatus: 'idle',
    sessionStatus: 'idle',
    statusText: '等待启动 OpenLive',
    anchorRoomId: null,
    anchorName: '',
    anchorUid: null,
    anchorAvatar: '',
    gameId: '',
    websocketUrl: '',
    websocketState: 'CLOSED',
    heartbeatAlive: false,
    lastHeartbeatAt: 0,
    lastHeartbeatReplyAt: 0,
    reconnectCount: 0,
    reconnectLimit: OPEN_LIVE_MAX_RECONNECT,
    tokenExpiresAt: 0,
    latency: 0,
    connected: false,
    manualClose: false,
    fallbackSuggested: false,
    lastError: '',
  }
}

export class OpenLiveProvider implements LiveProvider {
  readonly kind = 'open-live' as const

  private readonly options: LiveProviderOptions
  private socket: WebSocket | null = null
  private heartbeatTimer: number | null = null
  private reconnectTimer: number | null = null
  private authTimeoutTimer: number | null = null
  private reconnectCount = 0
  private connected = false
  private manualClose = false
  private connectResolve: (() => void) | null = null
  private connectReject: ((error: Error) => void) | null = null
  private lastHeartbeatAt = 0
  private lastHeartbeatReplyAt = 0
  private gameId = ''
  private anchorInfo: OpenLiveAnchorInfo | null = null
  private websocketInfo: OpenLiveWebsocketInfo | null = null
  private websocketUrl = ''
  private latency = 0
  private state: OpenLiveStateSnapshot

  constructor(options: LiveProviderOptions) {
    this.options = options
    this.state = createInitialState(options)
  }

  connect(): Promise<void> {
    this.manualClose = false
    this.clearReconnectTimer()
    this.clearAuthTimeoutTimer()
    this.clearHeartbeatTimer()
    this.emitState({
      identityCode: this.options.openLiveIdentityCode?.trim() ?? '',
      identityCodeValid: validateIdentityCode(this.options.openLiveIdentityCode?.trim() ?? ''),
      manualClose: false,
      reconnectCount: this.reconnectCount,
    })

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
    this.closeSocket(1000, 'manual-close')
    await this.releaseSession('manual-close')
    this.emitConnectionStatus('disconnected', 'OpenLive 已断开')
    this.emitState({
      authStatus: 'idle',
      sessionStatus: 'ended',
      statusText: 'OpenLive 已断开',
      connected: false,
      manualClose: true,
      heartbeatAlive: false,
      websocketState: 'CLOSED',
      lastError: '',
    })
  }

  sendHeartbeat(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.lastHeartbeatAt = performance.now()
      this.emitState({
        heartbeatAlive: true,
        lastHeartbeatAt: Date.now(),
      })
      this.socket.send(createPacket(PacketOperation.Heartbeat, new Uint8Array(), PacketVersion.Heartbeat))
      this.emitDebug('protocol', 'HEARTBEAT', '已发送 OpenLive WebSocket 心跳')
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
      const identityCode = this.options.openLiveIdentityCode?.trim() ?? ''
      if (!config.appId || !config.accessKeyId || !config.accessKeySecret) {
        throw new OpenLiveProviderError('未配置 OpenLive AppId / AccessKey，请检查环境变量', {
          fallbackSuggested: true,
        })
      }
      if (!validateIdentityCode(identityCode)) {
        throw new OpenLiveProviderError('请先填写有效的 OpenLive 官方身份码', {
          fallbackSuggested: true,
        })
      }

      if (this.gameId) {
        await this.releaseSession('restart-before-start')
      }

      this.emitState({
        roomId: this.options.roomId,
        identityCode,
        identityCodeValid: true,
        authStatus: 'validating',
        sessionStatus: status === 'reconnecting' ? 'recovering' : 'starting',
        statusText: status === 'reconnecting' ? '正在恢复 OpenLive 会话' : '正在启动 OpenLive 会话',
        connected: false,
        fallbackSuggested: false,
        lastError: '',
      })
      this.emitConnectionStatus(status, this.state.statusText)

      const data = await requestOpenLive<OpenLiveStartData>('/v2/app/start', {
        code: identityCode,
        app_id: config.appId,
      })

      this.anchorInfo = data.anchor_info
      this.gameId = data.game_info.game_id
      this.websocketInfo = data.websocket_info
      this.websocketUrl = data.websocket_info.wss_link?.find(Boolean) ?? data.websocket_info.ws_link?.find(Boolean) ?? ''
      this.emitState({
        anchorRoomId: data.anchor_info.room_id,
        anchorName: data.anchor_info.uname,
        anchorUid: data.anchor_info.uid,
        anchorAvatar: data.anchor_info.uface,
        gameId: data.game_info.game_id,
        websocketUrl: this.websocketUrl,
        tokenExpiresAt: parseTokenExpiresAt(data.websocket_info.auth_body),
        sessionStatus: 'starting',
        statusText: 'OpenLive 会话已建立，等待 WebSocket 认证',
      })
      await this.openWebSocket(status)
    } catch (error) {
      const resolvedError = normalizeOpenLiveError(error, 'OpenLive 启动失败')
      this.handleConnectError(resolvedError, status)
    }
  }

  private async releaseSession(reason: string): Promise<void> {
    const gameId = this.gameId
    this.gameId = ''
    this.websocketInfo = null
    this.websocketUrl = ''

    if (!gameId) {
      this.emitState({
        sessionStatus: 'ended',
        gameId: '',
        websocketUrl: '',
        heartbeatAlive: false,
      })
      return
    }

    this.emitState({
      sessionStatus: 'ending',
      statusText: '正在结束 OpenLive 会话',
      gameId,
    })
    this.emitDebug('protocol', 'SESSION_END', `结束 OpenLive 会话：${reason}`, { gameId, reason })

    try {
      await requestOpenLive('/v2/app/end', {
        app_id: getOpenLiveConfig().appId,
        game_id: gameId,
      }, {
        allowEmptyData: true,
      })
    } catch (error) {
      const resolvedError = normalizeOpenLiveError(error, 'OpenLive 会话关闭失败')
      logWarn('connection', resolvedError.message)
      this.emitDebug('error', 'SESSION_END', resolvedError.message)
    }

    this.emitState({
      authStatus: 'idle',
      sessionStatus: 'ended',
      statusText: 'OpenLive 会话已结束',
      connected: false,
      heartbeatAlive: false,
      gameId: '',
      websocketUrl: '',
      tokenExpiresAt: 0,
    })
  }

  private async openWebSocket(status: 'connecting' | 'reconnecting'): Promise<void> {
    if (!this.websocketInfo || !this.websocketUrl) {
      throw new OpenLiveProviderError('OpenLive 未返回可用的 WebSocket 地址', {
        retryable: true,
        fallbackSuggested: true,
      })
    }

    this.closeSocket(1000, 'replace-socket')
    this.socket = new WebSocket(this.websocketUrl)
    this.socket.binaryType = 'arraybuffer'
    this.emitState({
      websocketState: readyStateText(this.socket),
      statusText: 'OpenLive WebSocket 正在建立连接',
      sessionStatus: status === 'reconnecting' ? 'recovering' : 'starting',
    })
    this.emitConnectionStatus(status, 'OpenLive WebSocket 正在建立连接')

    this.socket.onopen = () => {
      if (!this.socket || !this.websocketInfo) {
        return
      }

      const authBody = typeof this.websocketInfo.auth_body === 'string'
        ? this.websocketInfo.auth_body
        : JSON.stringify(this.websocketInfo.auth_body)
      this.socket.send(createPacket(PacketOperation.Auth, authBody))
      this.startAuthTimeout()
      this.emitDebug('protocol', 'AUTH_SEND', 'OpenLive 认证包已发送', {
        websocketUrl: this.websocketUrl,
      })
      this.emitState({
        websocketState: readyStateText(this.socket),
        statusText: 'OpenLive WebSocket 已连接，等待认证',
      })
      logInfo('connection', `OpenLive WebSocket 已连接，房间 ${this.anchorInfo?.room_id ?? this.options.roomId}`)
    }

    this.socket.onmessage = async (event) => {
      try {
        const frames = await decodePacketFrames(event.data as ArrayBuffer)
        for (const frame of frames) {
          await this.handleFrame(frame.header.operation, frame.body)
        }
      } catch (error) {
        const resolvedError = normalizeOpenLiveError(error, 'OpenLive 消息解析失败')
        this.emitDebug('error', 'FRAME_PARSE', resolvedError.message)
        logWarn('connection', resolvedError.message)
      }
    }

    this.socket.onerror = () => {
      const error = new OpenLiveProviderError('OpenLive WebSocket 连接异常', {
        retryable: true,
      })
      this.emitDebug('error', 'SOCKET_ERROR', error.message)
      this.emitConnectionStatus('error', error.message, error.message)
      this.emitState({
        lastError: error.message,
        fallbackSuggested: error.fallbackSuggested,
      })
    }

    this.socket.onclose = (event) => {
      this.connected = false
      this.clearHeartbeatTimer()
      this.clearAuthTimeoutTimer()
      this.socket = null
      this.emitState({
        connected: false,
        heartbeatAlive: false,
        websocketState: 'CLOSED',
      })

      if (this.manualClose) {
        return
      }

      const reason = event.reason || `OpenLive 连接已断开 (${event.code})`
      this.emitDebug('status', 'SOCKET_CLOSE', reason, {
        code: event.code,
        reason,
      })
      this.rejectPendingConnect(reason)
      this.scheduleReconnect(reason)
    }
  }

  private async handleFrame(operation: number, body: Uint8Array): Promise<void> {
    if (operation === PacketOperation.AuthReply) {
      const payload = pickRecord(JSON.parse(decodeTextBody(body) || '{}'))
      const code = pickNumber(payload.code)
      if (code !== 0) {
        throw resolveOpenLiveError(code, `OpenLive 认证失败，返回码 ${code}`)
      }

      this.connected = true
      this.reconnectCount = 0
      this.clearAuthTimeoutTimer()
      this.startHeartbeat()
      this.emitDebug('status', 'AUTH_SUCCESS', 'OpenLive 认证成功')
      this.emitState({
        authStatus: 'authenticated',
        sessionStatus: 'active',
        statusText: `OpenLive 已连接 ${this.anchorInfo?.uname ?? ''}`.trim(),
        websocketState: readyStateText(this.socket),
        reconnectCount: 0,
        connected: true,
        heartbeatAlive: true,
        fallbackSuggested: false,
        lastError: '',
      })
      this.emitConnectionStatus('connected', this.state.statusText)
      this.resolvePendingConnect()
      return
    }

    if (operation === PacketOperation.HeartbeatReply) {
      this.options.onPopularity(readPopularity(body))
      this.lastHeartbeatReplyAt = Date.now()
      if (this.lastHeartbeatAt > 0) {
        this.latency = Math.round(performance.now() - this.lastHeartbeatAt)
        this.options.onLatency?.(this.latency)
      }
      this.emitDebug('protocol', 'HEARTBEAT_ACK', 'OpenLive 心跳已响应', {
        latency: this.latency,
      })
      this.emitState({
        heartbeatAlive: true,
        lastHeartbeatReplyAt: this.lastHeartbeatReplyAt,
        latency: this.latency,
      })
      return
    }

    if (operation !== PacketOperation.Message) {
      return
    }

    const text = decodeTextBody(body)
    parseMessageList(text).forEach((payload) => {
      this.options.onRawCommand?.(payload)
      this.emitDebug('raw', payload.cmd ?? 'UNKNOWN', '收到 OpenLive 原始事件', payload)

      const message = parseOpenLiveCommand(payload)
      if (message) {
        this.options.onMessage(message)
        return
      }

      switch (payload.cmd) {
        case 'LIVE_OPEN_PLATFORM_LIVE':
        case 'LIVE':
          this.options.onMessage(createSystemNotice('主播已开播，OpenLive 会话正常运行', 'normal', 'LIVE_OPEN_PLATFORM_LIVE'))
          break
        case 'LIVE_OPEN_PLATFORM_LIVE_OFF':
        case 'PREPARING':
          this.options.onMessage(createSystemNotice('主播已下播，OpenLive 会话即将结束', 'warning', 'LIVE_OPEN_PLATFORM_LIVE_OFF'))
          break
        case 'LIVE_OPEN_PLATFORM_GAME_END':
        case 'LIVE_OPEN_PLATFORM_INTERACTION_END':
          this.options.onMessage(createSystemNotice('OpenLive 场次已结束，等待自动恢复', 'warning', payload.cmd ?? 'OPENLIVE_END'))
          break
        default:
          logDebug('connection', `OpenLive 忽略事件 ${payload.cmd ?? 'UNKNOWN'}`)
          break
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
      const error = new OpenLiveProviderError('OpenLive 认证超时', {
        retryable: true,
      })
      this.emitDebug('error', 'AUTH_TIMEOUT', error.message)
      this.rejectPendingConnect(error.message)
      this.emitConnectionStatus('error', error.message, error.message)
      this.emitState({
        authStatus: 'failed',
        sessionStatus: 'error',
        statusText: error.message,
        lastError: error.message,
      })
      this.closeSocket(4000, 'auth-timeout')
    }, OPEN_LIVE_AUTH_TIMEOUT_MS)
  }

  private async sendHttpHeartbeat(): Promise<void> {
    if (!this.gameId) {
      return
    }

    try {
      await requestOpenLive('/v2/app/heartbeat', {
        game_id: this.gameId,
      }, {
        allowEmptyData: true,
      })
      this.emitDebug('protocol', 'HEARTBEAT_HTTP', 'OpenLive HTTP 心跳成功', {
        gameId: this.gameId,
      })
    } catch (error) {
      const resolvedError = normalizeOpenLiveError(error, 'OpenLive 心跳失败')
      logWarn('connection', resolvedError.message)
      this.emitDebug('error', 'HEARTBEAT_HTTP', resolvedError.message, {
        code: resolvedError.code,
      })
      if (resolvedError.retryable) {
        this.closeSocket(4001, 'heartbeat-failed')
      }
    }
  }

  private handleConnectError(error: OpenLiveProviderError, status: 'connecting' | 'reconnecting'): void {
    logError('connection', error.message)
    this.rejectPendingConnect(error.message)
    this.emitDebug('error', 'CONNECT_ERROR', error.message, {
      code: error.code ?? 0,
      retryable: error.retryable,
      status,
    })
    this.emitState({
      authStatus: 'failed',
      sessionStatus: 'error',
      statusText: error.message,
      fallbackSuggested: error.fallbackSuggested,
      lastError: error.message,
      connected: false,
      heartbeatAlive: false,
      websocketState: readyStateText(this.socket),
    })
    this.emitConnectionStatus('error', error.message, error.message)

    if (!this.manualClose && this.options.autoReconnect && error.retryable) {
      this.scheduleReconnect(error.message)
    }
  }

  private scheduleReconnect(reason: string): void {
    if (this.manualClose || !this.options.autoReconnect) {
      this.emitConnectionStatus('disconnected', reason)
      return
    }

    if (this.reconnectCount >= OPEN_LIVE_MAX_RECONNECT) {
      const message = 'OpenLive 已达到最大重连次数，请手动检查身份码与应用配置'
      this.emitDebug('error', 'RECONNECT_STOP', message)
      this.emitConnectionStatus('error', message, message)
      this.emitState({
        sessionStatus: 'error',
        statusText: message,
        lastError: message,
        fallbackSuggested: true,
      })
      return
    }

    this.clearReconnectTimer()
    this.reconnectCount += 1
    const reconnectDelayMs = Math.min(
      OPEN_LIVE_MAX_RECONNECT_INTERVAL_MS,
      Math.max(this.options.reconnectInterval * 1000, this.options.reconnectInterval * 1000 * this.reconnectCount),
    )
    const reconnectInSeconds = Math.round(reconnectDelayMs / 1000)
    this.emitDebug('status', 'RECONNECT_SCHEDULED', `${reason}，${reconnectInSeconds} 秒后重连`, {
      reconnectCount: this.reconnectCount,
      reconnectInSeconds,
    })
    this.options.onReconnectScheduled?.({
      reconnectCount: this.reconnectCount,
      reconnectInSeconds,
      reason,
    })
    this.emitState({
      authStatus: 'validating',
      sessionStatus: 'recovering',
      statusText: `${reason}，${reconnectInSeconds} 秒后重连`,
      reconnectCount: this.reconnectCount,
      heartbeatAlive: false,
      lastError: reason,
    })
    this.emitConnectionStatus('reconnecting', this.state.statusText, reason)
    this.reconnectTimer = window.setTimeout(() => {
      void this.startAndConnect('reconnecting')
    }, reconnectDelayMs)
  }

  private emitConnectionStatus(status: LiveProviderStatusPayload['status'], statusText: string, error?: string): void {
    this.options.onStatus({
      status,
      statusText,
      websocketState: readyStateText(this.socket),
      reconnectCount: this.reconnectCount,
      providerKind: this.kind,
      openLive: { ...this.state },
      error,
    })
  }

  private emitState(patch: Partial<OpenLiveStateSnapshot>): void {
    this.state = {
      ...this.state,
      ...patch,
      roomKey: this.options.roomKey,
      roomId: patch.roomId ?? this.state.roomId,
      reconnectCount: patch.reconnectCount ?? this.reconnectCount,
      websocketState: patch.websocketState ?? readyStateText(this.socket),
      manualClose: patch.manualClose ?? this.manualClose,
      connected: patch.connected ?? this.connected,
    }
    this.options.onOpenLiveState?.({ ...this.state })
  }

  private emitDebug(
    type: OpenLiveDebugRecord['type'],
    command: string,
    message: string,
    payload?: OpenLiveDebugRecord['payload'],
  ): void {
    this.options.onOpenLiveDebug?.({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: Date.now(),
      roomKey: this.options.roomKey,
      type,
      command,
      message,
      payload,
    })
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

  private closeSocket(code: number, reason: string): void {
    if (!this.socket) {
      return
    }

    this.socket.onopen = null
    this.socket.onmessage = null
    this.socket.onerror = null
    this.socket.onclose = null
    this.socket.close(code, reason)
    this.socket = null
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
