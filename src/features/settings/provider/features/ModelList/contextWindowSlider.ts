/** Evenly spaced slider indices → token counts (avoids linear-scale mark pile-up). */
export const CONTEXT_WINDOW_STEPS = [
  0, 4_096, 8_192, 16_384, 32_768, 65_536, 128_000, 200_000, 512_000, 1_000_000, 2_000_000,
] as const

export const MAX_CONTEXT_WINDOW = CONTEXT_WINDOW_STEPS[CONTEXT_WINDOW_STEPS.length - 1]!

export const formatContextWindowMark = (tokens: number) => {
  if (tokens <= 0) return '0'
  if (tokens >= 1_000_000 && tokens % 1_000_000 === 0) return `${tokens / 1_000_000}M`
  if (tokens % 1024 === 0) return `${tokens / 1024}K`
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`
  return String(tokens)
}

const LABELED_CONTEXT_WINDOW_TOKENS = new Set([
  0, 4_096, 8_192, 16_384, 32_768, 65_536, 200_000, 1_000_000, 2_000_000,
])

export const CONTEXT_WINDOW_MARKS = Object.fromEntries(
  CONTEXT_WINDOW_STEPS.flatMap((tokens, index) =>
    LABELED_CONTEXT_WINDOW_TOKENS.has(tokens) ? [[index, formatContextWindowMark(tokens)]] : []
  )
)

export const nearestContextWindowStepIndex = (tokens: number) => {
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < CONTEXT_WINDOW_STEPS.length; index += 1) {
    const distance = Math.abs(CONTEXT_WINDOW_STEPS[index]! - tokens)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }
  return bestIndex
}
