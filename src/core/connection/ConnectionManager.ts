import { eventBus } from '../events/EventBus'
import { logDebug, logInfo, logWarn } from '../logger/Logger'
import { createLiveProvider } from '../live'
import { performanceMonitor } from '../performance/PerformanceMonitor'
import { pluginManager } from '../plugins/PluginManager'
import { recoveryManager } from '../recovery/RecoveryManager'
import type { ConnectionStatusPayload, RoomConnectionOptions } from '../../types/websocket'
import type { LiveProvider } from '../live'

interface ConnectionSession {
  provider: LiveProvider
  popularity: number
  latency: number
  manualDisconnect: boolean
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
      manualDisconnect: false,
      popularity: 0,
      latency: 0,
      provider: createLiveProvider(options.providerKind ?? 'public', {
        roomId: options.roomId,
        reconnectInterval: options.reconnectInterval,
        autoReconnect: options.autoReconnect,
        onStatus: (payload) => {
          Object.assign(connectionState, payload)
          performanceMonitor.updateConnectionStatus(payload.status)

          if (payload.status === 'disconnected' || payload.status === 'error') {
            void pluginManager.emitHook('onDisconnect', {
              roomKey,
              connection: { ...connectionState },
            })
            if (!session.manualDisconnect && payload.status === 'error') {
              void recoveryManager.reportFailure('connection', `${roomKey}: ${payload.statusText}`)
            }
            eventBus.emit('DISCONNECT', {
              roomKey,
              connection: { ...connectionState },
            })
            return
          }

          if (payload.status === 'connected') {
            void pluginManager.emitHook('onConnect', {
              roomKey,
              connection: { ...connectionState },
            })
          }
          eventBus.emit('CONNECT', {
            roomKey,
            connection: { ...connectionState },
          })
        },
        onPopularity: (popularity) => {
          session.popularity = popularity
          performanceMonitor.updateLatency(session.latency)
          eventBus.emit('POPULARITY_UPDATE', {
            roomKey,
            popularity,
            latency: session.latency,
          })
        },
        onLatency: (latency) => {
          session.latency = latency
          performanceMonitor.updateLatency(latency)
          eventBus.emit('POPULARITY_UPDATE', {
            roomKey,
            popularity: session.popularity,
            latency,
          })
        },
        onMessage: (message) => {
          performanceMonitor.recordMessage()
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
    await session.provider.connect()
  }

  disconnect(roomKey: string): void {
    const session = this.sessions.get(roomKey)
    if (!session) {
      return
    }

    session.manualDisconnect = true
    void session.provider.disconnect()
    this.sessions.delete(roomKey)
    logInfo('connection', `ConnectionManager disconnect ${roomKey}`)
  }

  reconnect(roomKey: string, options: RoomConnectionOptions): Promise<void> {
    logWarn('connection', `ConnectionManager reconnect ${roomKey}`)
    return this.connect(roomKey, options)
  }

  disconnectAll(): void {
    this.sessions.forEach((session, roomKey) => {
      void session.provider.disconnect()
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
