import { describe, expect, it } from 'vitest'

import {
  formatCompactDateTime,
  formatDate,
  formatDateTime,
  formatDuration,
  formatFullDateTime,
  formatNumber,
  formatSize,
  formatTokenNumber,
  getPercentage,
} from './format'

describe('formatTokenNumber', () => {
  it('formats small and mid context windows', () => {
    expect(formatTokenNumber(500)).toBe('1K')
    expect(formatTokenNumber(4096)).toBe('4K')
    expect(formatTokenNumber(32_000)).toBe('32K')
    expect(formatTokenNumber(65_536)).toBe('64K')
  })

  it('formats common model windows without decimals', () => {
    expect(formatTokenNumber(128_000)).toBe('128K')
    expect(formatTokenNumber(131_072)).toBe('128K')
    expect(formatTokenNumber(200_000)).toBe('200K')
    expect(formatTokenNumber(400_000)).toBe('400K')
    expect(formatTokenNumber(1_000_000)).toBe('1M')
    expect(formatTokenNumber(1_048_576)).toBe('1M')
  })
})

describe('formatSize', () => {
  it('formats common byte ranges', () => {
    expect(formatSize(0)).toBe('0 B')
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(1536)).toBe('1.5 KB')
    expect(formatSize(10 * 1024)).toBe('10 KB')
    expect(formatSize(1.5 * 1024 * 1024)).toBe('1.5 MB')
  })

  it('returns - for invalid input', () => {
    expect(formatSize(Number.NaN)).toBe('-')
    expect(formatSize(-1)).toBe('-')
  })
})

describe('formatDateTime / formatDate', () => {
  it('returns fallback for empty values', () => {
    expect(formatDateTime(null)).toBe('-')
    expect(formatDate(undefined)).toBe('-')
    expect(formatDateTime('', { fallback: 'N/A' })).toBe('N/A')
  })

  it('keeps invalid string input', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })

  it('formats a valid instant', () => {
    const value = new Date('2026-07-27T08:30:00+08:00')
    expect(formatDateTime(value, { locale: 'en-US' })).toMatch(/2026/)
    expect(formatDate(value, { locale: 'en-US' })).toMatch(/2026/)
  })

  it('omits year when year is explicitly undefined', () => {
    const value = new Date('2026-07-27T08:30:00Z')
    expect(formatDateTime(value, { locale: 'en-US', timeZone: 'UTC', year: undefined })).not.toMatch(/2026/)
  })
})

describe('formatCompactDateTime', () => {
  it('formats Shanghai time without year or 日', () => {
    const value = new Date('2026-09-08T08:08:00+08:00')
    const text = formatCompactDateTime(value, { timeZone: 'Asia/Shanghai' })
    expect(text).toContain('08:08:00')
    expect(text).not.toContain('2026')
    expect(text).not.toContain('日')
  })

  it('returns the empty placeholder for missing values', () => {
    expect(formatCompactDateTime(null)).toBe('--')
  })
})

describe('formatFullDateTime', () => {
  it('formats a full Shanghai datetime', () => {
    const value = new Date('2026-08-14T04:30:00.000Z')
    const text = formatFullDateTime(value, { timeZone: 'Asia/Shanghai' })
    expect(text).toContain('2026年8月14日')
    expect(text).toContain('12:30:00')
  })
})

describe('formatNumber / formatDuration / getPercentage', () => {
  it('groups numbers in zh-CN', () => {
    expect(formatNumber(13_111)).toBe('13,111')
  })

  it('formats milliseconds as seconds', () => {
    expect(formatDuration(null)).toBe('--')
    expect(formatDuration(1234)).toBe('1.23s')
    expect(formatDuration(1000)).toBe('1.00s')
    expect(formatDuration(Number.NaN, 'n/a')).toBe('n/a')
  })

  it('computes rounded percents', () => {
    expect(getPercentage(13, 100)).toBe(13)
    expect(getPercentage(0, 0)).toBe(0)
  })
})
