/** Asia/Shanghai 计费周期工具（禁止用 UTC 算 period）。 */

const SHANGHAI_TZ = 'Asia/Shanghai'

const shanghaiParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '00'
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
  }
}

/** 返回上海时区下的 `YYYY-MM`。 */
export const getShanghaiBillingPeriod = (date: Date = new Date()): string => {
  const { year, month } = shanghaiParts(date)
  return `${year}-${String(month).padStart(2, '0')}`
}

/**
 * 下一次重置时刻：上海时区下月 1 日 00:00，转为 UTC Date。
 */
export const getNextShanghaiResetAt = (date: Date = new Date()): Date => {
  const { year, month } = shanghaiParts(date)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  // 构造「上海本地」下月 1 日 00:00 对应的瞬时：用固定偏移不可靠（有 DST 历史），
  // 上海无 DST，等价 UTC+8。
  return new Date(Date.UTC(nextYear, nextMonth - 1, 1, -8, 0, 0))
}

export const formatResetCountdown = (now: Date = new Date()) => {
  const resetAt = getNextShanghaiResetAt(now)
  const ms = Math.max(0, resetAt.getTime() - now.getTime())
  const totalHours = Math.floor(ms / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return { days, hours, ms, resetAt: resetAt.toISOString() }
}
