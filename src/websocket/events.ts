import type { DanmuMessageItem, RawDanmuCommand } from '../types/danmu'
import { decodeTextBody } from './packet'
import { createSystemNotice, normalizeRawMessage, parseCommandText } from '../core/message/MessageFactory'

export { createSystemNotice }

export function parseCommandBody(body: Uint8Array): RawDanmuCommand[] {
  return parseCommandText(decodeTextBody(body))
}

export function parseDanmuEvent(payload: RawDanmuCommand): DanmuMessageItem | null {
  return normalizeRawMessage(payload)
}
