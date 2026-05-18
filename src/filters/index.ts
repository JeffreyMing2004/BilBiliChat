import type { DanmuMessageItem } from '../types/danmu'
import type { AppSettings } from '../types/settings'

function includesAnyKeyword(content: string, keywords: string[]): boolean {
  const normalized = content.toLowerCase()
  return keywords.some((keyword) => normalized.includes(keyword))
}

export function shouldFilterMessage(
  message: DanmuMessageItem,
  settings: AppSettings,
  keywordFilters: string[],
  userBlacklist: string[],
): boolean {
  if (message.type === 'gift' && settings.hideGift) {
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
