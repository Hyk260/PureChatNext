import { describe, expect, it } from 'vitest'

import { AssistantCategory } from '@/features/community/types'

import { ASSISTANT_CATEGORY_LABELS, filterCommunityAgents } from './agents'

const sampleAgent = {
  author: 'demo',
  avatar: '🤖',
  category: AssistantCategory.Programming,
  createdAt: '2024-01-01',
  description: '写代码',
  identifier: 'demo/coder',
  systemRole: 'You code.',
  title: '编程助手',
} as const

describe('filterCommunityAgents', () => {
  it('does not mix custom agents into market results', () => {
    expect(filterCommunityAgents([sampleAgent], { category: AssistantCategory.Custom })).toEqual([])
  })

  it('still filters market categories', () => {
    expect(filterCommunityAgents([sampleAgent], { category: AssistantCategory.Programming })).toEqual([sampleAgent])
    expect(filterCommunityAgents([sampleAgent], { category: AssistantCategory.Life })).toEqual([])
  })
})

describe('ASSISTANT_CATEGORY_LABELS', () => {
  it('labels the custom filter tab', () => {
    expect(ASSISTANT_CATEGORY_LABELS[AssistantCategory.Custom]).toBe('自定义')
  })
})
