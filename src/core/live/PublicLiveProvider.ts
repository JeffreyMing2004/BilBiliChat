import { LiveDanmuSocket } from '../../websocket'
import type { LiveProvider, LiveProviderOptions, LiveProviderRoomInfo } from './LiveProvider'

export class PublicLiveProvider implements LiveProvider {
  readonly kind = 'public' as const

  private readonly socket: LiveDanmuSocket
  private connected = false
  private readonly roomId: number

  constructor(options: LiveProviderOptions) {
    this.roomId = options.roomId
    this.socket = new LiveDanmuSocket({
      roomId: options.roomId,
      reconnectInterval: options.reconnectInterval,
      autoReconnect: options.autoReconnect,
      onStatus: (payload) => {
        this.connected = payload.status === 'connected'
        options.onStatus(payload)
      },
      onPopularity: options.onPopularity,
      onLatency: options.onLatency,
      onMessage: options.onMessage,
      onRawCommand: options.onRawCommand,
      onReconnectScheduled: options.onReconnectScheduled,
    })
  }

  async connect(): Promise<void> {
    await this.socket.connect()
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.socket.disconnect()
  }

  sendHeartbeat(): void {
    this.socket.sendHeartbeat()
  }

  async getRoomInfo(): Promise<LiveProviderRoomInfo> {
    return {
      kind: this.kind,
      roomId: this.roomId,
      displayName: 'Bilibili Public WebSocket',
      connected: this.connected,
    }
  }
}
