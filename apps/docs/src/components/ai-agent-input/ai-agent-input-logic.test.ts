import { describe, expect, it } from 'vitest'
import { addUniqueSkill, clipInsertedText, findSlashToken, isEditorVisuallyEmpty } from './ai-agent-input-logic'

describe('AI Agent Input editor logic', () => {
  it('treats a skill-only editor as visually non-empty', () => {
    expect(isEditorVisuallyEmpty('', [])).toBe(true)
    expect(isEditorVisuallyEmpty('', ['deep-research'])).toBe(false)
    expect(isEditorVisuallyEmpty('问题', [])).toBe(false)
  })

  it('finds only the slash token and preserves its leading whitespace', () => {
    expect(findSlashToken('hello /deep')).toEqual({ end: 11, query: 'deep', start: 6 })
    expect(findSlashToken('/sum')).toEqual({ end: 4, query: 'sum', start: 0 })
    expect(findSlashToken('path/to')).toBeNull()
  })

  it('clips inserted text without exceeding the text limit', () => {
    expect(clipInsertedText(998, 'abcd', 1000)).toBe('ab')
    expect(clipInsertedText(1000, 'a', 1000)).toBe('')
  })

  it('deduplicates skills and enforces the configured maximum', () => {
    expect(addUniqueSkill(['deep-research'], 'deep-research')).toEqual(['deep-research'])
    expect(
      addUniqueSkill(['deep-research', 'summarize', 'step-by-step', 'troubleshoot'], 'summarize'),
    ).toHaveLength(4)
  })
})
