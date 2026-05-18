import { loadStorageItem, saveStorageItem } from '../../settings'
import { logInfo, logWarn } from '../logger/Logger'

export type RecoveryDomain = 'overlay' | 'room' | 'connection' | 'window'

export interface RecoveryRoomSnapshot {
  id: string
  roomIdInput: string
  autoConnect: boolean
  status: string
}

export interface RecoverySnapshot {
  updatedAt: number
  activeRoomId: string
  rooms: RecoveryRoomSnapshot[]
  windows: Record<string, { visible: boolean; lastSeenAt: number }>
  failures: Record<RecoveryDomain, number>
  lastReason: string
}

type RecoveryProcedure = () => void | Promise<void>

const RECOVERY_STORAGE_KEY = 'livedanmu.recovery.v1'

function createDefaultSnapshot(): RecoverySnapshot {
  return {
    updatedAt: Date.now(),
    activeRoomId: '',
    rooms: [],
    windows: {},
    failures: {
      overlay: 0,
      room: 0,
      connection: 0,
      window: 0,
    },
    lastReason: '',
  }
}

export class RecoveryManager {
  private snapshot = loadStorageItem<RecoverySnapshot>(RECOVERY_STORAGE_KEY, createDefaultSnapshot())
  private readonly procedures = new Map<RecoveryDomain, Map<string, RecoveryProcedure>>()
  private lastOverlayHeartbeatAt = 0

  getSnapshot(): RecoverySnapshot {
    return JSON.parse(JSON.stringify(this.snapshot)) as RecoverySnapshot
  }

  restoreLastSnapshot(): RecoverySnapshot {
    return this.getSnapshot()
  }

  captureRooms(activeRoomId: string, rooms: RecoveryRoomSnapshot[]): void {
    this.snapshot.activeRoomId = activeRoomId
    this.snapshot.rooms = rooms
    this.persist()
  }

  captureWindow(label: string, visible: boolean): void {
    this.snapshot.windows[label] = {
      visible,
      lastSeenAt: Date.now(),
    }
    this.persist()
  }

  markOverlayHeartbeat(): void {
    this.lastOverlayHeartbeatAt = Date.now()
  }

  checkOverlayHealth(maxSilentMs = 10_000): boolean {
    if (this.lastOverlayHeartbeatAt === 0) {
      return true
    }

    return Date.now() - this.lastOverlayHeartbeatAt <= maxSilentMs
  }

  register(domain: RecoveryDomain, id: string, procedure: RecoveryProcedure): () => void {
    const procedures = this.procedures.get(domain) ?? new Map<string, RecoveryProcedure>()
    procedures.set(id, procedure)
    this.procedures.set(domain, procedures)

    return () => {
      procedures.delete(id)
      if (procedures.size === 0) {
        this.procedures.delete(domain)
      }
    }
  }

  async reportFailure(domain: RecoveryDomain, reason: string): Promise<void> {
    this.snapshot.failures[domain] += 1
    this.snapshot.lastReason = reason
    this.persist()
    logWarn('recovery', `${domain} 触发恢复：${reason}`)
    await this.run(domain)
  }

  async run(domain: RecoveryDomain): Promise<void> {
    const procedures = this.procedures.get(domain)
    if (!procedures?.size) {
      return
    }

    for (const [id, procedure] of procedures.entries()) {
      await procedure()
      logInfo('recovery', `${domain} 恢复流程已执行：${id}`)
    }
  }

  private persist(): void {
    this.snapshot.updatedAt = Date.now()
    saveStorageItem(RECOVERY_STORAGE_KEY, this.snapshot)
  }
}

export const recoveryManager = new RecoveryManager()
