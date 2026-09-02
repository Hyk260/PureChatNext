import { describe, expect, it } from 'vitest'

import { buildChatRuntimeInstructions } from '../runtimeInstructions'

describe('buildChatRuntimeInstructions', () => {
  it('injects the current Shanghai date and time for relative-time questions', () => {
    const instructions = buildChatRuntimeInstructions(new Date('2026-08-14T04:30:00.000Z'))

    expect(instructions).toContain('2026年8月14日')
    expect(instructions).toContain('12:30:00')
    expect(instructions).toContain('Asia/Shanghai')
    expect(instructions).toContain('今天、明天、现在')
  })
})
