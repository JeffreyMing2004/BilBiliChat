import type { DanmuMessageItem, RawDanmuCommand } from '../types/danmu'
import type { DanmuMessage, GiftMessage, SCMessage, SystemMessage } from '../types/message'
import { colorFromText } from '../utils/color'
import { formatTime } from '../utils/time'
import { decodeTextBody } from './packet'

function createBaseMessage() {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: formatTime(),
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

function parseDanmuMessage(payload: RawDanmuCommand): DanmuMessage | null {
  const info = payload.info ?? []
  const content = typeof info[1] === 'string' ? info[1] : ''
  const userInfo = Array.isArray(info[2]) ? info[2] : []
  const username = typeof userInfo[1] === 'string' ? userInfo[1] : '匿名用户'

  if (!content) {
    return null
  }

  return {
    ...createBaseMessage(),
    type: 'danmu',
    username,
    content,
    summary: `[${username}] ${content}`,
    userColor: colorFromText(username),
    rawCommand: 'DANMU_MSG',
  }
}

function parseGiftMessage(payload: RawDanmuCommand): GiftMessage {
  const data = payload.data ?? {}
  const username = typeof data.uname === 'string' ? data.uname : '未知用户'
  const giftName = typeof data.giftName === 'string' ? data.giftName : '礼物'
  const giftCount = typeof data.num === 'number' ? data.num : 1
  const giftType = typeof data.coin_type === 'string'
    ? data.coin_type === 'gold' ? '金瓜子礼物' : '银瓜子礼物'
    : '普通礼物'
  const price = typeof data.price === 'number' ? data.price : undefined
  const content = `${giftName} × ${giftCount}`

  return {
    ...createBaseMessage(),
    type: 'gift',
    username,
    content,
    summary: `[${username}] 赠送了 ${giftName} × ${giftCount}`,
    userColor: '#ffb75e',
    giftName,
    giftCount,
    giftType,
    price,
    rawCommand: 'SEND_GIFT',
  }
}

function resolveSCColor(price: number): string {
  if (price >= 2000) {
    return '#ff4d4f'
  }
  if (price >= 500) {
    return '#ff7a45'
  }
  if (price >= 100) {
    return '#fa8c16'
  }
  return '#13c2c2'
}

function parseSuperChatMessage(payload: RawDanmuCommand): SCMessage {
  const data = payload.data ?? {}
  const userInfo = typeof data.user_info === 'object' && data.user_info
    ? (data.user_info as Record<string, unknown>)
    : {}
  const username = typeof userInfo.uname === 'string' ? userInfo.uname : '醒目留言用户'
  const content = typeof data.message === 'string' ? data.message : '发送了一条醒目留言'
  const price = typeof data.price === 'number' ? data.price : 0
  const priceColor = resolveSCColor(price)

  return {
    ...createBaseMessage(),
    type: 'superChat',
    username,
    content,
    summary: `[${username}] ￥${price}
${content}`,
    userColor: '#ffffff',
    price,
    priceColor,
    rawCommand: 'SUPER_CHAT_MESSAGE',
  }
}

function parseInteractMessage(payload: RawDanmuCommand): SystemMessage {
  const data = payload.data ?? {}
  const username = typeof data.uname === 'string' ? data.uname : '访客'

  return {
    ...createBaseMessage(),
    type: 'system',
    username,
    content: `${username} 进入直播间`,
    summary: `[${username}] 进入直播间`,
    systemKind: 'entry',
    tone: 'soft',
    rawCommand: 'INTERACT_WORD',
  }
}

export function createSystemNotice(
  content: string,
  tone: SystemMessage['tone'] = 'normal',
  rawCommand = 'SYSTEM',
): SystemMessage {
  return {
    ...createBaseMessage(),
    type: 'system',
    username: '系统',
    content,
    summary: content,
    systemKind: 'notice',
    tone,
    rawCommand,
  }
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
