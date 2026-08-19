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

/**
 * 上下文窗口 tokens 短写（模型卡 / 能力标签）。
 * 小窗口按 1024 取整；低于约 41K 或达到 128K 及以上时按 1000 取整，避免出现 400.0K 这类小数。
 */
export const formatTokenNumber = (num: number): string => {
  if (!num && num !== 0) return '--'

  if (num > 0 && num < 1024) return '1K'

  let kiloToken = Math.floor(num / 1024)
  if ((num >= 1024 && num < 1024 * 41) || num >= 128_000) {
    kiloToken = Math.floor(num / 1000)
  }
  if (num === 131_072) return '128K'
  return kiloToken < 1000 ? `${kiloToken}K` : `${Math.floor(kiloToken / 1000)}M`
}

const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/** Format byte size as `B` / `KB` / `MB` / `GB` / `TB`. */
export const formatSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '-'
  if (bytes === 0) return '0 B'

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), SIZE_UNITS.length - 1)
  const value = bytes / 1024 ** exponent
  const digits = exponent === 0 || value >= 10 ? 0 : 1
  return `${value.toFixed(digits)} ${SIZE_UNITS[exponent]}`
}

export type FormatDateInput = Date | string | number | null | undefined

export type FormatDateOptions = Intl.DateTimeFormatOptions & {
  fallback?: string
  locale?: string
}

const DEFAULT_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
}

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}

const resolveDate = (value: FormatDateInput, fallback: string): { date: Date } | { text: string } => {
  if (value == null || value === '') return { text: fallback }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return { text: typeof value === 'string' ? value : fallback }
  }
  return { date }
}

/** Format as locale date + time. Null / empty → `fallback` (default `'-'`). */
export const formatDateTime = (value: FormatDateInput, options?: FormatDateOptions): string => {
  const { fallback = '-', locale = 'zh-CN', ...formatOptions } = options ?? {}
  const resolved = resolveDate(value, fallback)
  if ('text' in resolved) return resolved.text
  return resolved.date.toLocaleString(locale, { ...DEFAULT_DATETIME_OPTIONS, ...formatOptions })
}

/** Format as locale date only. Null / empty → `fallback` (default `'-'`). */
export const formatDate = (value: FormatDateInput, options?: FormatDateOptions): string => {
  const { fallback = '-', locale = 'zh-CN', ...formatOptions } = options ?? {}
  const resolved = resolveDate(value, fallback)
  if ('text' in resolved) return resolved.text
  return resolved.date.toLocaleDateString(locale, { ...DEFAULT_DATE_OPTIONS, ...formatOptions })
}
