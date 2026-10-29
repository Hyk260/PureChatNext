import { describe, expect, it } from 'vitest'
import { taskInputSchema, taskPatchSchema, normalizeTaskInput } from './schema'

const input = {
  agentId: 'agt_inbox',
  channels: ['qq', 'wechat'],
  enabled: true,
  instruction: '',
  model: 'test-model',
  priority: 0,
  provider: 'openai',
  schedule: { frequency: 'daily', hour: 8, minute: 30, timezone: 'Asia/Shanghai' },
  title: '喝水提醒',
}

describe('task request validation', () => {
  it('normalizes the instruction and deduplicates channels', () => {
    const parsed = taskInputSchema.parse({ ...input, channels: ['qq', 'qq'] })
    expect(parsed.channels).toEqual(['qq'])
    expect(normalizeTaskInput(parsed).instruction).toBe('喝水提醒')
  })
  it('rejects arbitrary recipients, user identities, unknown frequencies and invalid priorities', () => {
    expect(taskInputSchema.safeParse({ ...input, userId: 'other' }).success).toBe(false)
    expect(taskInputSchema.safeParse({ ...input, recipient: 'someone' }).success).toBe(false)
    expect(taskInputSchema.safeParse({ ...input, priority: 5 }).success).toBe(false)
    expect(
      taskInputSchema.safeParse({ ...input, schedule: { ...input.schedule, frequency: 'minutely' } }).success
    ).toBe(false)
    expect(taskInputSchema.safeParse({ ...input, channels: ['slack'] }).success).toBe(false)
  })
  it('supports state-only changes and requires a weekly day', () => {
    expect(taskPatchSchema.parse({ status: 'completed' })).toEqual({ status: 'completed' })
    expect(
      taskInputSchema.safeParse({ ...input, schedule: { ...input.schedule, frequency: 'weekly', weekdays: [] } })
        .success
    ).toBe(false)
  })
})
