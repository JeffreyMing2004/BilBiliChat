import { eventBus } from '../events/EventBus'
import { logDebug, logInfo, logWarn } from '../logger/Logger'
import type { ConnectionStatusPayload, RoomConnectionOptions } from '../../types/websocket'
import { LiveDanmuSocket } from '../../websocket'

interface ConnectionSession {
  socket: LiveDanmuSocket
  popularity: number
  latency: number
}

export class ConnectionManager {
  private readonly sessions = new Map<string, ConnectionSession>()

  async connect(roomKey: string, options: RoomConnectionOptions): Promise<void> {
    this.disconnect(roomKey)

    const connectionState: ConnectionStatusPayload = {
      status: 'idle',
      statusText: '等待连接',
      websocketState: 'CLOSED',
      reconnectCount: 0,
    }

    const session: ConnectionSession = {
      popularity: 0,
      latency: 0,
      socket: new LiveDanmuSocket({
        roomId: options.roomId,
        reconnectInterval: options.reconnectInterval,
        autoReconnect: options.autoReconnect,
        onStatus: (payload) => {
          Object.assign(connectionState, payload)

          if (payload.status === 'disconnected' || payload.status === 'error') {
            eventBus.emit('DISCONNECT', {
              roomKey,
              connection: { ...connectionState },
            })
            return
          }

          eventBus.emit('CONNECT', {
            roomKey,
            connection: { ...connectionState },
          })
        },
        onPopularity: (popularity) => {
          session.popularity = popularity
          eventBus.emit('POPULARITY_UPDATE', {
            roomKey,
            popularity,
            latency: session.latency,
          })
        },
        onLatency: (latency) => {
          session.latency = latency
          eventBus.emit('POPULARITY_UPDATE', {
            roomKey,
            popularity: session.popularity,
            latency,
          })
        },
        onMessage: (message) => {
          eventBus.emit('MESSAGE', {
            roomKey,
            message,
          })
        },
        onRawCommand: (payload) => {
          logDebug('websocket', `${roomKey} raw ${payload.cmd ?? 'UNKNOWN'}`)
        },
        onReconnectScheduled: (notice) => {
          eventBus.emit('RECONNECT', {
            roomKey,
            notice,
          })
        },
      }),
    }

    this.sessions.set(roomKey, session)
    logInfo('connection', `ConnectionManager connect ${roomKey}`)
    await session.socket.connect()
  }

  disconnect(roomKey: string): void {
    const session = this.sessions.get(roomKey)
    if (!session) {
      return
    }

    session.socket.disconnect()
    this.sessions.delete(roomKey)
    logInfo('connection', `ConnectionManager disconnect ${roomKey}`)
  }

  reconnect(roomKey: string, options: RoomConnectionOptions): Promise<void> {
    logWarn('connection', `ConnectionManager reconnect ${roomKey}`)
    return this.connect(roomKey, options)
  }

  disconnectAll(): void {
    this.sessions.forEach((session, roomKey) => {
      session.socket.disconnect()
      logInfo('connection', `ConnectionManager disconnect all ${roomKey}`)
    })
    this.sessions.clear()
  }

  has(roomKey: string): boolean {
    return this.sessions.has(roomKey)
  }

  destroy(): void {
    this.disconnectAll()
  }
}

export const connectionManager = new ConnectionManager()
