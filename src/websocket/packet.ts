export const BILIBILI_WEBSOCKET_URL = 'wss://broadcastlv.chat.bilibili.com/sub'
export const PACKET_HEADER_LENGTH = 16

export const PacketVersion = {
  Json: 0,
  Heartbeat: 1,
  Zlib: 2,
  Brotli: 3,
} as const

export const PacketOperation = {
  Heartbeat: 2,
  HeartbeatReply: 3,
  Message: 5,
  Auth: 7,
  AuthReply: 8,
} as const

export interface PacketHeader {
  packetLen: number
  headerLen: number
  version: number
  operation: number
  sequence: number
}

export interface PacketFrame {
  header: PacketHeader
  body: Uint8Array
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer
}

export function createPacket(
  operation: number,
  body: string | Uint8Array = new Uint8Array(),
  version = PacketVersion.Heartbeat,
): ArrayBuffer {
  const bodyBytes = typeof body === 'string' ? new TextEncoder().encode(body) : body
  const buffer = new ArrayBuffer(PACKET_HEADER_LENGTH + bodyBytes.byteLength)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  view.setUint32(0, PACKET_HEADER_LENGTH + bodyBytes.byteLength)
  view.setUint16(4, PACKET_HEADER_LENGTH)
  view.setUint16(6, version)
  view.setUint32(8, operation)
  view.setUint32(12, 1)
  bytes.set(bodyBytes, PACKET_HEADER_LENGTH)

  return buffer
}

export function createAuthPacket(roomId: number, token?: string): ArrayBuffer {
  const authPayload: Record<string, unknown> = {
    uid: 0,
    roomid: roomId,
    protover: 2, // 使用 Deflate 压缩（浏览器原生支持），避免 Brotli WASM 加载失败
    platform: 'web',
    type: 2,
  }
  if (token) {
    authPayload.key = token
  }
  return createPacket(
    PacketOperation.Auth,
    JSON.stringify(authPayload),
  )
}

export function parsePacketHeader(view: DataView, offset = 0): PacketHeader {
  return {
    packetLen: view.getUint32(offset),
    headerLen: view.getUint16(offset + 4),
    version: view.getUint16(offset + 6),
    operation: view.getUint32(offset + 8),
    sequence: view.getUint32(offset + 12),
  }
}

export function splitPacketFrames(buffer: ArrayBuffer): PacketFrame[] {
  const frames: PacketFrame[] = []
  let offset = 0

  while (offset < buffer.byteLength) {
    const view = new DataView(buffer, offset)
    const header = parsePacketHeader(view)
    const packetEnd = offset + header.packetLen
    const bodyStart = offset + header.headerLen
    const body = new Uint8Array(buffer.slice(bodyStart, packetEnd))

    frames.push({
      header,
      body,
    })

    offset = packetEnd
  }

  return frames
}

export function readPopularity(body: Uint8Array): number {
  const view = new DataView(toArrayBuffer(body))
  return view.getUint32(0)
}

export function decodeTextBody(body: Uint8Array): string {
  return new TextDecoder().decode(body)
}

export function bodyToArrayBuffer(body: Uint8Array): ArrayBuffer {
  return toArrayBuffer(body)
}
