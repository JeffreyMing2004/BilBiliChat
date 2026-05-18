import type { PacketFrame } from './packet'
import { bodyToArrayBuffer, PacketOperation, PacketVersion, splitPacketFrames } from './packet'

interface BrotliDecoderModule {
  decompress: (input: Uint8Array) => Uint8Array
}

let brotliDecoderPromise: Promise<BrotliDecoderModule> | null = null

function getBrotliDecoder(): Promise<BrotliDecoderModule> {
  if (!brotliDecoderPromise) {
    brotliDecoderPromise = import('brotli-dec-wasm').then((module) => module.default)
  }

  return brotliDecoderPromise
}

async function decompressDeflate(body: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bodyToArrayBuffer(body)]).stream().pipeThrough(new DecompressionStream('deflate'))
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

async function expandFrame(frame: PacketFrame): Promise<PacketFrame[]> {
  if (frame.header.version === PacketVersion.Zlib) {
    const decompressed = await decompressDeflate(frame.body)
    return decodePacketFrames(bodyToArrayBuffer(decompressed))
  }

  if (frame.header.version !== PacketVersion.Brotli) {
    return [frame]
  }

  const decoder = await getBrotliDecoder()
  const decompressed = decoder.decompress(frame.body)
  return decodePacketFrames(bodyToArrayBuffer(decompressed))
}

export async function decodePacketFrames(buffer: ArrayBuffer): Promise<PacketFrame[]> {
  const rawFrames = splitPacketFrames(buffer)
  const decodedFrames: PacketFrame[] = []

  for (const frame of rawFrames) {
    decodedFrames.push(...(await expandFrame(frame)))
  }

  return decodedFrames
}

export async function decodeMessageFrames(buffer: ArrayBuffer): Promise<PacketFrame[]> {
  const frames = await decodePacketFrames(buffer)
  return frames.filter((frame) => frame.header.operation === PacketOperation.Message)
}
