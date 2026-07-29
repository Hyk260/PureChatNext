import { describe, expect, it } from 'vitest'

import { formatDate, formatDateTime, formatSize, formatTokenNumber } from './format'

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
})
