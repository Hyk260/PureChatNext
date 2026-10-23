import { describe, expect, it } from 'vitest'

import { countBusyTopics } from './store'

describe('countBusyTopics', () => {
  it('counts only chat topics that are currently busy', () => {
    expect(countBusyTopics({ 'agent-a:topic-a': true, 'agent-b:topic-b': true, 'agent-c:topic-c': false })).toBe(2)
  })

  it('returns zero when no topic is busy', () => {
    expect(countBusyTopics({})).toBe(0)
  })
})
