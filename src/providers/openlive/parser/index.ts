import {
  createDanmuMessage,
  createGiftMessage,
  createSuperChatMessage,
  createSystemMessage,
} from '../../../core/message/MessageFactory'
import type { LiveMessage } from '../../../types/message'
import type { RawDanmuCommand } from '../../../types/websocket'

type OpenLiveRecord = Record<string, unknown>

function pickRecord(value: unknown): OpenLiveRecord {
  return typeof value === 'object' && value ? value as OpenLiveRecord : {}
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return undefined
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function pickBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'number') {
      return value !== 0
    }
    if (typeof value === 'string' && value.trim()) {
      if (value === '1' || value.toLowerCase() === 'true') {
        return true
      }
      if (value === '0' || value.toLowerCase() === 'false') {
        return false
      }
    }
  }

  return undefined
}

function normalizeCommand(command: string): string {
  const value = command.trim()
  const aliasMap: Record<string, string> = {
    LIVE_OPEN_PLATFORM_SEND_GIFT: 'SEND_GIFT',
    LIVE_OPEN_PLATFORM_SUPER_CHAT: 'SUPER_CHAT_MESSAGE',
    LIVE_OPEN_PLATFORM_ENTER_ROOM: 'INTERACT_WORD',
    LIVE_OPEN_PLATFORM_LIKE: 'LIKE_INFO_V3_CLICK',
    LIVE_OPEN_PLATFORM_GUARD: 'GUARD_BUY',
  }

  return aliasMap[value] ?? value
}

function resolveGuardLabel(level?: number): string {
  switch (level) {
    case 1:
      return '总督'
    case 2:
      return '提督'
    case 3:
      return '舰长'
    default:
      return ''
  }
}

function resolveScColor(price: number): string {
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

function buildMessageMeta(data: OpenLiveRecord) {
  const medal = pickRecord(data.medal_info ?? data.fans_medal ?? data.fans_medal_info)
  const guardLevel = pickNumber(data.guard_level, data.guardLevel, medal.guard_level)
  const medalName = pickString(data.fans_medal_name, medal.medal_name, medal.name)
  const medalLevel = pickNumber(data.fans_medal_level, medal.medal_level, medal.level)
  const likeCount = pickNumber(data.like_count, data.click_count, data.likes)
  const avatar = pickString(data.uface, data.face, data.avatar)
  const userLevel = pickNumber(data.user_level, data.level, data.wealth_level)
  const timestamp = pickNumber(data.timestamp, data.send_time)
  const roomId = pickNumber(data.room_id, data.roomId)
  const messageId = pickString(data.msg_id, data.message_id, data.id)
  const dmType = pickNumber(data.dm_type, data.msg_type)
  const gloryLevel = pickNumber(data.glory_level)
  const isAdmin = pickBoolean(data.is_admin, data.admin)
  const medalWearing = pickBoolean(
    data.fans_medal_wearing_status,
    medal.wearing_status,
    medal.is_wear,
  )

  return {
    provider: 'open-live' as const,
    avatar: avatar || undefined,
    userLevel,
    medalName: medalName || undefined,
    medalLevel,
    guardLevel,
    guardLabel: resolveGuardLabel(guardLevel),
    likeCount,
    openLiveOpenId: pickString(data.open_id) || undefined,
    openLiveUnionId: pickString(data.union_id) || undefined,
    openLiveRoomId: roomId,
    openLiveMessageId: messageId || undefined,
    openLiveTimestamp: timestamp,
    openLiveEmojiImageUrl: pickString(data.emoji_img_url, data.emoji_url) || undefined,
    openLiveDmType: dmType,
    openLiveGloryLevel: gloryLevel,
    openLiveReplyOpenId: pickString(data.reply_open_id) || undefined,
    openLiveReplyUsername: pickString(data.reply_uname) || undefined,
    openLiveIsAdmin: isAdmin,
    openLiveFansMedalWearing: medalWearing,
  }
}

function buildUsername(data: OpenLiveRecord, fallback = '观众'): string {
  return pickString(data.uname, data.username, pickRecord(data.user_info).uname) || fallback
}

function buildEntryMessage(command: string, data: OpenLiveRecord): LiveMessage {
  const username = buildUsername(data, '访客')
  const action = command === 'ENTRY_EFFECT' ? '高能进场' : '进入直播间'
  return createSystemMessage(
    username,
    `${username} ${action}`,
    'entry',
    'soft',
    command,
    buildMessageMeta(data),
  )
}

export function parseOpenLiveCommand(payload: RawDanmuCommand): LiveMessage | null {
  const command = normalizeCommand(payload.cmd ?? '')
  const data = pickRecord(payload.data)
  const username = buildUsername(data)
  const meta = buildMessageMeta(data)

  switch (command) {
    case 'LIVE_OPEN_PLATFORM_DM': {
      const content = pickString(data.msg, data.message, data.content)
      if (!content) {
        return null
      }

      return createDanmuMessage(username, content, 'LIVE_OPEN_PLATFORM_DM', meta)
    }
    case 'LIVE_OPEN_PLATFORM_DM_MIRROR': {
      const content = pickString(data.msg, data.message, data.content)
      if (!content) {
        return null
      }

      return createDanmuMessage('跨房弹幕', content, 'LIVE_OPEN_PLATFORM_DM_MIRROR', {
        ...meta,
        openLiveMirror: true,
      })
    }
    case 'SEND_GIFT': {
      const giftName = pickString(data.gift_name, data.giftName, data.name) || '礼物'
      const giftCount = pickNumber(data.gift_num, data.giftNum, data.num, data.combo_num) ?? 1
      const price = pickNumber(data.price, data.coin_value, data.discount_price)
      const giftType = price && price > 0 ? '付费礼物' : '免费礼物'
      return createGiftMessage(username, giftName, giftCount, giftType, 'SEND_GIFT', price, meta)
    }
    case 'SUPER_CHAT_MESSAGE': {
      const content = pickString(data.message, data.msg, data.content) || '发送了一条醒目留言'
      const price = pickNumber(data.rmb, data.price) ?? 0
      return createSuperChatMessage(username, content, price, 'SUPER_CHAT_MESSAGE', resolveScColor(price), meta)
    }
    case 'INTERACT_WORD':
    case 'ENTRY_EFFECT':
      return buildEntryMessage(command, data)
    case 'LIKE_INFO_V3_CLICK': {
      const likeCount = pickNumber(data.like_count, data.click_count, data.likes) ?? 1
      return createSystemMessage(
        username,
        `${username} 点赞了直播间${likeCount > 1 ? ` × ${likeCount}` : ''}`,
        'notice',
        'soft',
        'LIKE_INFO_V3_CLICK',
        {
          ...meta,
          likeCount,
        },
      )
    }
    case 'GUARD_BUY': {
      const guardLevel = pickNumber(data.guard_level, data.guardLevel) ?? 3
      const guardLabel = resolveGuardLabel(guardLevel) || pickString(data.guard_name, data.guard_unit) || '大航海'
      const count = pickNumber(data.num, data.guard_num, data.buy_num) ?? 1
      return createSystemMessage(
        username,
        `${username} 开通了 ${guardLabel}${count > 1 ? ` × ${count}` : ''}`,
        'notice',
        'normal',
        'GUARD_BUY',
        {
          ...meta,
          guardLevel,
          guardLabel,
        },
      )
    }
    default:
      return null
  }
}
