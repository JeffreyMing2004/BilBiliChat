const USER_COLORS = ['#5ea0ff', '#7dffb3', '#ffb65e', '#c983ff', '#ff7da8', '#73f0ff']

export function colorFromText(input: string): string {
  let hash = 0

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index)
    hash |= 0
  }

  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}
