import type { DanmuMessageItem, RawDanmuCommand } from '../types/danmu'
import { formatTime } from '../utils/time'
import { decodeTextBody } from './packet'

function createMessage(
  partial: Omit<DanmuMessageItem, 'id' | 'timestamp'>,
): DanmuMessageItem {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: formatTime(),
    ...partial,
  }
}

export function parseCommandText(text: string): RawDanmuCommand[] {
  return text
    .split(/(?<=\})(?=\{)/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as RawDanmuCommand]
      } catch {
        return []
      }
    })
}

export function parseCommandBody(body: Uint8Array): RawDanmuCommand[] {
  return parseCommandText(decodeTextBody(body))
}

function parseDanmuMessage(payload: RawDanmuCommand): DanmuMessageItem | null {
  const info = payload.info ?? []
  const content = typeof info[1] === 'string' ? info[1] : ''
  const userInfo = Array.isArray(info[2]) ? info[2] : []
  const username = typeof userInfo[1] === 'string' ? userInfo[1] : '匿名用户'

  if (!content) {
    return null
  }

  return createMessage({
    type: 'danmu',
    username,
    content,
    summary: `[${username}] ${content}`,
    rawCommand: 'DANMU_MSG',
  })
}

function parseGiftMessage(payload: RawDanmuCommand): DanmuMessageItem {
  const data = payload.data ?? {}
  const username = typeof data.uname === 'string' ? data.uname : '未知用户'
  const giftName = typeof data.giftName === 'string' ? data.giftName : '礼物'
  const count = typeof data.num === 'number' ? data.num : 1
  const content = `${giftName}${count > 1 ? ` x${count}` : ''}`

  return createMessage({
    type: 'gift',
    username,
    content,
    summary: `[${username}] 赠送了 ${content}`,
    rawCommand: 'SEND_GIFT',
  })
}

function parseSuperChatMessage(payload: RawDanmuCommand): DanmuMessageItem {
  const data = payload.data ?? {}
  const userInfo = typeof data.user_info === 'object' && data.user_info
    ? (data.user_info as Record<string, unknown>)
    : {}
  const username = typeof userInfo.uname === 'string' ? userInfo.uname : '醒目留言用户'
  const content = typeof data.message === 'string' ? data.message : '发送了一条醒目留言'
  const price = typeof data.price === 'number' ? data.price : 0

  return createMessage({
    type: 'superChat',
    username,
    content,
    summary: `[${username}] ￥${price}：${content}`,
    rawCommand: 'SUPER_CHAT_MESSAGE',
    price,
  })
}

function parseInteractMessage(payload: RawDanmuCommand): DanmuMessageItem {
  const data = payload.data ?? {}
  const username = typeof data.uname === 'string' ? data.uname : '访客'

  return createMessage({
    type: 'entry',
    username,
    content: '进入直播间',
    summary: `[${username}] 进入直播间`,
    rawCommand: 'INTERACT_WORD',
  })
}

export function parseDanmuEvent(payload: RawDanmuCommand): DanmuMessageItem | null {
  const command = payload.cmd?.split(':')[0] ?? ''

  switch (command) {
    case 'DANMU_MSG':
      return parseDanmuMessage(payload)
    case 'SEND_GIFT':
      return parseGiftMessage(payload)
    case 'SUPER_CHAT_MESSAGE':
      return parseSuperChatMessage(payload)
    case 'INTERACT_WORD':
      return parseInteractMessage(payload)
    default:
      return null
  }
}
