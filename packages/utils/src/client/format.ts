const isNumber = (value: unknown): value is number => typeof value === 'number' && !Number.isNaN(value)

/**
 * Format large numbers as K / M / B / T; smaller values get thousand separators.
 */
export const formatShortenNumber = (num: unknown): string | number => {
  if (!num && num !== 0) return '--'
  if (!isNumber(num)) return num as string | number

  const formattedWithComma = new Intl.NumberFormat('en-US').format(num)

  if (num >= 1_000_000_000_000) {
    return (num / 1_000_000_000_000).toFixed(1) + 'T'
  }
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + 'B'
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M'
  }
  if (num >= 10_000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  if (num === 0) {
    return 0
  }
  return formattedWithComma
}
