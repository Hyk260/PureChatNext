import { describe, expect, it } from 'vitest'

import { formatContextTokens, getContextWindowModel, getContextWindowPartTokens } from './contextWindowModel'
import type { ContextWindowPart } from './contextWindowModel'

const exampleParts: ContextWindowPart[] = [
  { id: 'system', label: 'System prompt', locked: true, tokens: 20 },
  {
    id: 'files',
    items: [
      { id: 'schema', label: 'schema.prisma', tokens: 30 },
      { id: 'billing', label: 'billing.ts', tokens: 20 },
    ],
    label: 'Files',
  },
  { compact: true, id: 'chat', label: 'Conversation', tokens: 30 },
]

describe('getContextWindowPartTokens', () => {
  it('sums child items for grouped parts', () => {
    expect(getContextWindowPartTokens(exampleParts[1])).toBe(50)
  })

  it('treats missing, negative, and non-finite token values as zero', () => {
    expect(getContextWindowPartTokens({ id: 'empty', label: 'Empty', tokens: Number.NaN })).toBe(0)
    expect(getContextWindowPartTokens({ id: 'negative', label: 'Negative', tokens: -4 })).toBe(0)
  })
})

describe('getContextWindowModel', () => {
  it('computes usage, free capacity, and token segments', () => {
    const model = getContextWindowModel(exampleParts, 200, 10)

    expect(model.totalTokens).toBe(100)
    expect(model.remainingTokens).toBe(100)
    expect(model.usedPercentage).toBe(50)
    expect(model.cells.filter((cell) => cell.partId !== null)).toHaveLength(5)
    expect(model.cells[0].partId).toBe('system')
    expect(model.cells.slice(1, 3).every((cell) => cell.partId === 'files')).toBe(true)
  })

  it('fills the grid and clamps remaining capacity when usage exceeds the limit', () => {
    const model = getContextWindowModel([{ id: 'chat', label: 'Conversation', tokens: 120 }], 100, 10)

    expect(model.cells.every((cell) => cell.partId === 'chat')).toBe(true)
    expect(model.remainingTokens).toBe(0)
    expect(model.usedPercentage).toBe(120)
  })

  it('returns an empty grid for a zero limit', () => {
    const model = getContextWindowModel([{ id: 'chat', label: 'Conversation', tokens: 10 }], 0, 4)

    expect(model.cells.every((cell) => cell.partId === null)).toBe(true)
    expect(model.remainingTokens).toBe(0)
    expect(model.usedPercentage).toBe(0)
  })
})

describe('formatContextTokens', () => {
  it('formats precise usage and compact limits', () => {
    expect(formatContextTokens(88_000, true)).toBe('88.0K')
    expect(formatContextTokens(4_200, true)).toBe('4.2K')
    expect(formatContextTokens(200_000)).toBe('200K')
    expect(formatContextTokens(1_000_000)).toBe('1M')
  })
})
