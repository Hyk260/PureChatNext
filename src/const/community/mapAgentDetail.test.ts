import { describe, expect, it } from 'vitest'

import { mapDetailToDiscoverFields } from '../../../scripts/map-community-agent-detail'

describe('mapDetailToDiscoverFields', () => {
  it('maps systemRole, opening fields, examples, summary and tags', () => {
    const result = mapDetailToDiscoverFields({
      config: {
        openingMessage: '  Hello!  ',
        openingQuestions: ['Q1', '', 'Q2'],
        systemRole: 'You are helpful.',
      },
      examples: [
        { content: 'Hi', role: 'user' },
        { content: 'Hello', role: 'assistant' },
        { content: 'skip', role: 'system' },
        { content: '', role: 'user' },
      ],
      meta: {
        backgroundColor: '#fff',
        tags: ['life', ' ', 'dan'],
      },
      summary: '  A summary  ',
    })

    expect(result).toEqual({
      backgroundColor: '#fff',
      examples: [
        { content: 'Hi', role: 'user' },
        { content: 'Hello', role: 'assistant' },
      ],
      openingMessage: 'Hello!',
      openingQuestions: ['Q1', 'Q2'],
      summary: 'A summary',
      systemRole: 'You are helpful.',
      tags: ['life', 'dan'],
    })
  })

  it('returns empty systemRole when detail is missing', () => {
    expect(mapDetailToDiscoverFields({})).toEqual({ systemRole: '' })
  })
})
