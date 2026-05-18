import type { BaseMessage } from '../../types/message'
import type { OpenLiveStateSnapshot } from '../../types/openlive'

export function maskOpenLiveIdentityCode(code: string): string {
  const value = code.trim()
  if (!value) {
    return '未填写'
  }
  if (value.length <= 8) {
    return `${value.slice(0, 2)}****${value.slice(-2)}`
  }
  return `${value.slice(0, 4)}****${value.slice(-4)}`
}

export function validateOpenLiveIdentityCode(code: string): {
  valid: boolean
  statusText: string
} {
  const value = code.trim()
  if (!value) {
    return {
      valid: false,
      statusText: '未填写身份码',
    }
  }
  if (value.length < 8) {
    return {
      valid: false,
      statusText: '身份码长度过短',
    }
  }

  return {
    valid: true,
    statusText: '身份码格式可用',
  }
}

export function formatRemainingTime(timestamp: number): string {
  if (!timestamp) {
    return '--'
  }

  const remainingMs = timestamp - Date.now()
  if (remainingMs <= 0) {
    return '已过期'
  }

  const totalSeconds = Math.floor(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
}

export function resolveOpenLiveTone(state: OpenLiveStateSnapshot | null): 'success' | 'warning' | 'danger' | 'info' {
  if (!state) {
    return 'info'
  }
  if (state.connected && state.authStatus === 'authenticated') {
    return 'success'
  }
  if (state.lastError) {
    return 'danger'
  }
  if (state.sessionStatus === 'starting' || state.sessionStatus === 'recovering') {
    return 'warning'
  }
  return 'info'
}

export function resolveOpenLiveMessageTags(
  message: Pick<BaseMessage, 'provider' | 'userLevel' | 'medalName' | 'medalLevel' | 'guardLabel' | 'likeCount' | 'rawCommand'>,
): string[] {
  const tags: string[] = []

  if (message.provider === 'open-live') {
    tags.push('OpenLive')
  }

  if (typeof message.userLevel === 'number' && message.userLevel > 0) {
    tags.push(`Lv.${message.userLevel}`)
  }

  if (message.medalName) {
    tags.push(message.medalLevel ? `${message.medalName} ${message.medalLevel}` : message.medalName)
  }

  if (message.guardLabel) {
    tags.push(message.guardLabel)
  }

  if (message.rawCommand === 'LIKE_INFO_V3_CLICK' && typeof message.likeCount === 'number' && message.likeCount > 0) {
    tags.push(`赞 x${message.likeCount}`)
  }

  return tags
}

export function resolveOpenLiveMessageVariant(
  message: Pick<BaseMessage, 'provider' | 'rawCommand'>,
): 'default' | 'official' | 'like' | 'guard' | 'entry' {
  switch (message.rawCommand) {
    case 'LIKE_INFO_V3_CLICK':
      return 'like'
    case 'GUARD_BUY':
      return 'guard'
    case 'INTERACT_WORD':
    case 'ENTRY_EFFECT':
      return 'entry'
    default:
      return message.provider === 'open-live' ? 'official' : 'default'
  }
}
