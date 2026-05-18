import type { LiveMessage } from '../../types/message'
import type { AppSettings } from '../../types/settings'

function includesAnyKeyword(content: string, keywords: string[]): boolean {
  const normalized = content.toLowerCase()
  return keywords.some((keyword) => normalized.includes(keyword))
}

function createDuplicateKey(message: LiveMessage): string {
  if (message.type !== 'danmu') {
    return message.id
  }

  return `${message.type}:${message.username.toLowerCase()}:${message.content.trim().toLowerCase()}`
}

export function shouldFilterMessage(
  message: LiveMessage,
  settings: AppSettings,
  keywordFilters: string[],
  userBlacklist: string[],
): boolean {
  if (message.type === 'gift' && settings.hideGift) {
    return true
  }

  if (message.type === 'superChat' && settings.hideSuperChat) {
    return true
  }

  if (message.type === 'system') {
    if (message.rawCommand === 'INTERACT_WORD' && settings.hideEntry) {
      return true
    }

    if (message.rawCommand !== 'INTERACT_WORD' && settings.hideSystem) {
      return true
    }
  }

  if (userBlacklist.includes(message.username.toLowerCase())) {
    return true
  }

  return includesAnyKeyword(`${message.username} ${message.summary}`, keywordFilters)
}

export function filterMessages(
  messages: LiveMessage[],
  settings: AppSettings,
  keywordFilters: string[],
  userBlacklist: string[],
): LiveMessage[] {
  const recent = new Map<string, number>()
  const dedupeWindowMs = settings.dedupeWindowSeconds * 1000

  return messages.filter((message) => {
    if (shouldFilterMessage(message, settings, keywordFilters, userBlacklist)) {
      return false
    }

    if (!settings.dedupeEnabled || message.type !== 'danmu') {
      return true
    }

    const key = createDuplicateKey(message)
    const previousCreatedAt = recent.get(key)
    recent.set(key, message.createdAt)

    if (!previousCreatedAt) {
      return true
    }

    return message.createdAt - previousCreatedAt > dedupeWindowMs
  })
}
