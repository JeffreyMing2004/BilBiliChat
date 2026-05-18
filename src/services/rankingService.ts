import type { LiveMessage } from '../types/message'
import type { ContributorRankItem } from '../types/room'

function resolveContributionScore(message: LiveMessage): number {
  if (message.type === 'superChat') {
    return message.price
  }

  if (message.type === 'gift') {
    return message.price && message.price > 0
      ? Number((message.price / 1000).toFixed(2))
      : message.giftCount
  }

  return 0
}

export function calculateTopContributors(messages: LiveMessage[]): ContributorRankItem[] {
  const scoreMap = new Map<string, number>()

  messages.forEach((message) => {
    const score = resolveContributionScore(message)
    if (score <= 0) {
      return
    }

    scoreMap.set(message.username, (scoreMap.get(message.username) ?? 0) + score)
  })

  return [...scoreMap.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([username, score], index) => ({
      rank: index + 1,
      username,
      score,
    }))
}
