import type { BrotliWasmType } from 'brotli-wasm'

import type { BilibiliCommandPayload } from '../types/danmu'
import { WS_HEADER_LENGTH, WS_OPERATION, WS_PROTOCOL_VERSION } from './constants'

let brotliModulePromise: Promise<BrotliWasmType> | null = null

function getBrotliModule(): Promise<BrotliWasmType> {
  if (!brotliModulePromise) {
    brotliModulePromise = import('brotli-wasm').then((module) => module.default)
  }

  return brotliModulePromise
}

function createPacket(operation: number, body?: string): ArrayBuffer {
  const encoder = new TextEncoder()
  const bodyBuffer = body ? encoder.encode(body) : new Uint8Array()
  const packet = new ArrayBuffer(WS_HEADER_LENGTH + bodyBuffer.byteLength)
  const view = new DataView(packet)
  const bytes = new Uint8Array(packet)

  view.setUint32(0, WS_HEADER_LENGTH + bodyBuffer.byteLength)
  view.setUint16(4, WS_HEADER_LENGTH)
  view.setUint16(6, WS_PROTOCOL_VERSION.json)
  view.setUint32(8, operation)
  view.setUint32(12, 1)
  bytes.set(bodyBuffer, WS_HEADER_LENGTH)

  return packet
}

export function createAuthPacket(roomId: number, token: string): ArrayBuffer {
  return createPacket(
    WS_OPERATION.userAuth,
    JSON.stringify({
      uid: 0,
      roomid: roomId,
      protover: 3,
      platform: 'web',
      type: 2,
      key: token,
    }),
  )
}

export function createHeartbeatPacket(): ArrayBuffer {
  return createPacket(WS_OPERATION.heartbeat, '[object Object]')
}

async function decodeBody(protocolVersion: number, body: Uint8Array): Promise<Uint8Array[]> {
  if (protocolVersion === WS_PROTOCOL_VERSION.brotli) {
    const brotli = await getBrotliModule()
    const decompressed = brotli.decompress(body)
    return extractPacketBodies(decompressed.buffer as ArrayBuffer)
  }

  if (
    protocolVersion === WS_PROTOCOL_VERSION.json ||
    protocolVersion === WS_PROTOCOL_VERSION.heartbeat
  ) {
    return [body]
  }

  return []
}

async function extractPacketBodies(buffer: ArrayBuffer): Promise<Uint8Array[]> {
  const bodies: Uint8Array[] = []
  let offset = 0

  while (offset < buffer.byteLength) {
    const view = new DataView(buffer, offset)
    const packetLength = view.getUint32(0)
    const headerLength = view.getUint16(4)
    const protocolVersion = view.getUint16(6)
    const body = new Uint8Array(buffer.slice(offset + headerLength, offset + packetLength))
    const decodedBodies = await decodeBody(protocolVersion, body)

    bodies.push(...decodedBodies)
    offset += packetLength
  }

  return bodies
}

export async function parseCommandMessages(
  buffer: ArrayBuffer,
): Promise<Array<{ operation: number; payload: BilibiliCommandPayload }>> {
  const packets: Array<{ operation: number; payload: BilibiliCommandPayload }> = []
  const decoder = new TextDecoder()
  let offset = 0

  while (offset < buffer.byteLength) {
    const view = new DataView(buffer, offset)
    const packetLength = view.getUint32(0)
    const headerLength = view.getUint16(4)
    const protocolVersion = view.getUint16(6)
    const operation = view.getUint32(8)
    const body = new Uint8Array(buffer.slice(offset + headerLength, offset + packetLength))

    if (operation === WS_OPERATION.message) {
      const decodedBodies = await decodeBody(protocolVersion, body)

      for (const decodedBody of decodedBodies) {
        const text = decoder.decode(decodedBody)
        const lines = text
          .split(/(?<=\})(?=\{)/g)
          .map((item) => item.trim())
          .filter(Boolean)

        for (const line of lines) {
          try {
            packets.push({
              operation,
              payload: JSON.parse(line) as BilibiliCommandPayload,
            })
          } catch {
            // 忽略脏数据，避免阻塞实时消息流。
          }
        }
      }
    }

    offset += packetLength
  }

  return packets
}

export function readPopularity(buffer: ArrayBuffer): number {
  const view = new DataView(buffer)
  return view.getUint32(WS_HEADER_LENGTH)
}
