import { createPacket, PacketOperation, PacketVersion } from './packet'

export const HEARTBEAT_INTERVAL_MS = 30_000

export function createHeartbeatPacket(): ArrayBuffer {
  return createPacket(PacketOperation.Heartbeat, '[object Object]', PacketVersion.Heartbeat)
}
