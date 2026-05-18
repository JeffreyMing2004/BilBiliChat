import { logWarn } from '../logger/Logger'
import type { LiveProvider, LiveProviderOptions, LiveProviderRoomInfo } from './LiveProvider'

export class OpenLiveProvider implements LiveProvider {
  readonly kind = 'open-live' as const

  private readonly options: LiveProviderOptions
  private connected = false

  constructor(options: LiveProviderOptions) {
    this.options = options
  }

  async connect(): Promise<void> {
    this.options.onStatus({
      status: 'connecting',
      statusText: '正在初始化 OpenLive Provider',
      websocketState: 'CLOSED',
      reconnectCount: 0,
    })

    const error = 'OpenLive Provider 当前未配置开放平台凭证，暂无法建立连接'
    this.options.onStatus({
      status: 'error',
      statusText: error,
      websocketState: 'CLOSED',
      reconnectCount: 0,
      error,
    })
    this.connected = false
    logWarn('live', error)
    throw new Error(error)
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.options.onStatus({
      status: 'disconnected',
      statusText: 'OpenLive Provider 已断开',
      websocketState: 'CLOSED',
      reconnectCount: 0,
    })
  }

  sendHeartbeat(): void {
    if (this.connected) {
      logWarn('live', 'OpenLive Provider 心跳接口已触发，但当前仍未完成实际握手流程')
    }
  }

  async getRoomInfo(): Promise<LiveProviderRoomInfo> {
    return {
      kind: this.kind,
      roomId: this.options.roomId,
      displayName: 'Bilibili OpenLive Provider',
      connected: this.connected,
    }
  }
}
