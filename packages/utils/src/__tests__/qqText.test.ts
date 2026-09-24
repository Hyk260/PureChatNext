import { describe, expect, it } from 'vitest'

import { chunkQQText, QQ_MAX_TEXT_LENGTH } from '../qqText'

describe('chunkQQText', () => {
  it('returns a single chunk for short text', () => {
    expect(chunkQQText('hello')).toEqual(['hello'])
  })

  it('splits long text by the platform limit', () => {
    const text = 'a'.repeat(QQ_MAX_TEXT_LENGTH * 2 + 10)
    expect(chunkQQText(text)).toEqual([
      'a'.repeat(QQ_MAX_TEXT_LENGTH),
      'a'.repeat(QQ_MAX_TEXT_LENGTH),
      'a'.repeat(10),
    ])
  })

  it('clamps non-positive limits to avoid infinite loops', () => {
    expect(chunkQQText('abcd', 0)).toEqual(['a', 'b', 'c', 'd'])
    expect(chunkQQText('abcd', -2)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('does not split UTF-16 surrogate pairs at chunk boundaries', () => {
    const emoji = '😀' // 2 UTF-16 code units
    const text = `${'a'.repeat(3)}${emoji}${'b'.repeat(3)}`
    const chunks = chunkQQText(text, 4)
    expect(chunks.join('')).toBe(text)
    for (const chunk of chunks) {
      expect(chunk).not.toMatch(/[\uD800-\uDBFF]$/)
      expect(chunk).not.toMatch(/^[\uDC00-\uDFFF]/)
    }
  })

  it('prefers breaking at Chinese sentence punctuation', () => {
    const text = `${'甲'.repeat(8)}。${'乙'.repeat(8)}`
    const chunks = chunkQQText(text, 10)
    expect(chunks.join('')).toBe(text)
    expect(chunks[0]?.endsWith('。')).toBe(true)
    expect(chunks[1]?.startsWith('乙')).toBe(true)
  })

  it('avoids cutting inside a phrase when a prior sentence break fits', () => {
    const text = `${'前'.repeat(7)}。言语与${'后'.repeat(8)}`
    const chunks = chunkQQText(text, 10)
    expect(chunks.join('')).toBe(text)
    expect(chunks[0]?.endsWith('。')).toBe(true)
    expect(chunks[1]?.startsWith('言语与')).toBe(true)
  })
})
