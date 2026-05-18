import type { LiveProviderKind } from './live'

export type MessageType = 'danmu' | 'gift' | 'superChat' | 'system'
export type SystemMessageKind = 'entry' | 'status' | 'notice'

export interface BaseMessage {
  id: string
  type: MessageType
  timestamp: string
  createdAt: number
  username: string
  rawCommand: string
  summary: string
  provider?: LiveProviderKind
  avatar?: string
  userLevel?: number
  medalName?: string
  medalLevel?: number
  guardLevel?: number
  guardLabel?: string
  likeCount?: number
}

export interface DanmuMessage extends BaseMessage {
  type: 'danmu'
  content: string
  userColor: string
}

export interface GiftMessage extends BaseMessage {
  type: 'gift'
  content: string
  userColor: string
  giftName: string
  giftCount: number
  giftType: string
  price?: number
}

export interface SCMessage extends BaseMessage {
  type: 'superChat'
  content: string
  userColor: string
  price: number
  priceColor: string
}

export interface SystemMessage extends BaseMessage {
  type: 'system'
  content: string
  systemKind: SystemMessageKind
  tone: 'soft' | 'normal' | 'warning' | 'error'
}

export type LiveMessage = DanmuMessage | GiftMessage | SCMessage | SystemMessage
