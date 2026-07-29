import { describe, expect, it } from 'vitest'

import { type LocalChatTopic } from '@/features/chat/types'

import { organizeTopics } from './topicGrouping'

const NOW = new Date(2026, 6, 28, 12).getTime()

const topic = (id: string, createdAt: number, updatedAt = createdAt, patch: Partial<LocalChatTopic> = {}) => ({
  agentId: 'agent-1',
  createdAt,
  favorite: false,
  id,
  projectName: null,
  title: id,
  updatedAt,
  ...patch,
})

describe('organizeTopics', () => {
  it('groups by the selected time field and orders topics descending', () => {
    const old = new Date(2025, 2, 1).getTime()
    const yesterday = new Date(2026, 6, 27, 10).getTime()
    const today = new Date(2026, 6, 28, 9).getTime()
    const topics = [topic('old', old, today), topic('recent', yesterday, yesterday)]

    expect(organizeTopics(topics, 'byTime', 'createdAt', NOW).map((group) => group.id)).toEqual(['yesterday', '2025'])
    expect(organizeTopics(topics, 'byTime', 'updatedAt', NOW).map((group) => group.id)).toEqual(['today', 'yesterday'])
  })

  it('uses all time buckets in newest-first order', () => {
    const topics = [
      topic('today', new Date(2026, 6, 28, 8).getTime()),
      topic('yesterday', new Date(2026, 6, 27, 8).getTime()),
      topic('week', new Date(2026, 6, 24, 8).getTime()),
      topic('month', new Date(2026, 6, 5, 8).getTime()),
      topic('june', new Date(2026, 5, 5, 8).getTime()),
      topic('past-year', new Date(2025, 11, 5, 8).getTime()),
    ]

    expect(organizeTopics(topics, 'byTime', 'createdAt', NOW).map((group) => group.id)).toEqual([
      'today',
      'yesterday',
      'week',
      'month',
      '2026-06',
      '2025',
    ])
  })

  it('pins favorites as a separate group for grouped modes', () => {
    const topics = [
      topic('regular', new Date(2026, 6, 28, 10).getTime()),
      topic('favorite', new Date(2026, 6, 1).getTime(), undefined, { favorite: true }),
    ]

    const groups = organizeTopics(topics, 'byTime', 'createdAt', NOW)
    expect(groups[0]?.id).toBe('favorite')
    expect(groups[0]?.topics.map((item) => item.id)).toEqual(['favorite'])
  })

  it('pins favorites without a separate group in flat mode', () => {
    const topics = [
      topic('regular-new', 30),
      topic('favorite-old', 10, undefined, { favorite: true }),
      topic('regular-old', 20),
    ]

    expect(organizeTopics(topics, 'flat', 'createdAt', NOW)[0]?.topics.map((item) => item.id)).toEqual([
      'favorite-old',
      'regular-new',
      'regular-old',
    ])
  })

  it('applies the display limit after pinning favorites', () => {
    const topics = [
      topic('regular-new', 30),
      topic('favorite-old', 10, undefined, { favorite: true }),
      topic('regular-old', 20),
    ]

    expect(organizeTopics(topics, 'flat', 'createdAt', NOW, 2)[0]?.topics.map((item) => item.id)).toEqual([
      'favorite-old',
      'regular-new',
    ])
  })

  it('sorts projects by their latest topic and keeps no project last', () => {
    const topics = [
      topic('alpha', 20, undefined, { projectName: 'Alpha' }),
      topic('beta', 30, 80, { projectName: 'Beta' }),
      topic('none', 40, 100),
      topic('alpha-new', 50, undefined, { projectName: 'Alpha' }),
    ]

    const createdGroups = organizeTopics(topics, 'byProject', 'createdAt', NOW)
    expect(createdGroups.map((group) => group.title)).toEqual(['Alpha', 'Beta', '无项目'])
    expect(createdGroups[0]?.topics.map((item) => item.id)).toEqual(['alpha-new', 'alpha'])

    const updatedGroups = organizeTopics(topics, 'byProject', 'updatedAt', NOW)
    expect(updatedGroups.map((group) => group.title)).toEqual(['Beta', 'Alpha', '无项目'])
  })
})
