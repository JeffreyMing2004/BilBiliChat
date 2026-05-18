import type { BilibiliCommandPayload, DanmuMessageItem } from '../types/danmu'
import { colorFromText } from '../utils/color'
import { formatTime } from '../utils/time'

function createMessage(
  partial: Omit<DanmuMessageItem, 'id' | 'timestamp'>,
): DanmuMessageItem {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: formatTime(),
    ...partial,
  }
}

function parseDanmuMessage(payload: BilibiliCommandPayload): DanmuMessageItem | null {
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
    userColor: colorFromText(username),
    content,
    rawCommand: 'DANMU_MSG',
  })
}

function parseGiftMessage(payload: BilibiliCommandPayload): DanmuMessageItem {
  const data = payload.data ?? {}
  const username = typeof data.uname === 'string' ? data.uname : '未知用户'
  const giftName = typeof data.giftName === 'string' ? data.giftName : '礼物'
  const giftCount = typeof data.num === 'number' ? data.num : 1

  return createMessage({
    type: 'gift',
    username,
    userColor: colorFromText(username),
    content: `赠送 ${giftName} x${giftCount}`,
    rawCommand: 'SEND_GIFT',
    giftName,
    giftCount,
  })
}

function parseInteractMessage(payload: BilibiliCommandPayload): DanmuMessageItem {
  const data = payload.data ?? {}
  const username = typeof data.uname === 'string' ? data.uname : '访客'

  return createMessage({
    type: 'entry',
    username,
    userColor: colorFromText(username),
    content: '进入了直播间',
    rawCommand: 'INTERACT_WORD',
  })
}

function parseSuperChatMessage(payload: BilibiliCommandPayload): DanmuMessageItem {
  const data = payload.data ?? {}
  const userInfo = typeof data.user_info === 'object' && data.user_info
    ? (data.user_info as Record<string, unknown>)
    : {}
  const username = typeof userInfo.uname === 'string' ? userInfo.uname : '醒目留言用户'
  const content = typeof data.message === 'string' ? data.message : '发送了一条醒目留言'
  const price = typeof data.price === 'number' ? data.price : 0
  const backgroundColor =
    typeof data.background_bottom_color === 'string'
      ? data.background_bottom_color
      : '#f56c6c'

  return createMessage({
    type: 'superChat',
    username,
    userColor: backgroundColor,
    content,
    rawCommand: 'SUPER_CHAT_MESSAGE',
    price,
  })
}

export function parseDanmuPayload(payload: BilibiliCommandPayload): DanmuMessageItem | null {
  const command = payload.cmd?.split(':')[0] ?? ''

  switch (command) {
    case 'DANMU_MSG':
      return parseDanmuMessage(payload)
    case 'SEND_GIFT':
      return parseGiftMessage(payload)
    case 'INTERACT_WORD':
      return parseInteractMessage(payload)
    case 'SUPER_CHAT_MESSAGE':
      return parseSuperChatMessage(payload)
    default:
      return null
  }
}
