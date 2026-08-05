import { describe, expect, it } from 'vitest'

import type { ChannelTimelineEvent } from '@pure/database/models/channelEvent'

import { expandEventsToMessages } from '../timeline'

const base = (patch: Partial<ChannelTimelineEvent>): ChannelTimelineEvent => ({
  completedAt: null,
  content: '',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  id: 'evt-1',
  lastErrorCode: null,
  lastErrorMessage: null,
  messageKind: 'text',
  responseText: null,
  status: 'completed',
  ...patch,
})

describe('expandEventsToMessages', () => {
  it('expands inbound text into user + assistant bubbles', () => {
    const messages = expandEventsToMessages([
      base({
        completedAt: new Date('2026-01-01T00:00:01.000Z'),
        content: 'hi',
        responseText: 'hello',
      }),
    ])
    expect(messages).toEqual([
      expect.objectContaining({ id: 'evt-1:user', role: 'user', text: 'hi' }),
      expect.objectContaining({ id: 'evt-1:assistant', role: 'assistant', text: 'hello' }),
    ])
  })

  it('renders outbound as a single assistant bubble without a fake user turn', () => {
    const messages = expandEventsToMessages([
      base({
        completedAt: new Date('2026-01-01T00:00:02.000Z'),
        content: '',
        id: 'out-1',
        messageKind: 'outbound',
        responseText: 'manual reply',
      }),
    ])
    expect(messages).toEqual([
      {
        createdAt: '2026-01-01T00:00:02.000Z',
        id: 'out-1:assistant',
        messageKind: 'outbound',
        role: 'assistant',
        status: 'completed',
        text: 'manual reply',
      },
    ])
  })
})
