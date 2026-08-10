import { describe, expect, it } from 'vitest'

import type { ChannelTimelineEvent } from '@pure/database/models/channelEvent'

import { expandEventsToMessages } from '../timeline'

const base = (patch: Partial<ChannelTimelineEvent>): ChannelTimelineEvent => ({
  attachments: [],
  completedAt: null,
  content: '',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  durationMs: null,
  id: 'evt-1',
  lastErrorCode: null,
  lastErrorMessage: null,
  messageKind: 'text',
  model: null,
  provider: null,
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
      expect.objectContaining({ id: 'evt-1:assistant', role: 'assistant', source: 'system', text: 'hello' }),
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
        eventId: 'out-1',
        id: 'out-1:assistant',
        messageKind: 'outbound',
        role: 'assistant',
        source: 'manual',
        status: 'completed',
        text: 'manual reply',
      },
    ])
  })

  it('marks replies with persisted generation metadata as model output', () => {
    const messages = expandEventsToMessages([
      base({
        content: 'hi',
        durationMs: 1234,
        model: 'gpt-test',
        provider: 'openai',
        responseText: 'hello',
      }),
    ])

    expect(messages[1]).toMatchObject({
      durationMs: 1234,
      model: 'gpt-test',
      provider: 'openai',
      source: 'model',
    })
  })

  it('attaches generated files to the assistant message', () => {
    const messages = expandEventsToMessages([
      base({
        attachments: [
          {
            deliveryError: null,
            deliveryStatus: 'sent',
            direction: 'output',
            fileId: 'file-1',
            fileName: 'edited.xlsx',
            fileSize: 123,
            id: 'artifact-1',
            summary: 'A1 changed',
            version: 2,
          },
        ],
        responseText: '已修改',
      }),
    ])

    expect(messages[1]?.attachments).toEqual([
      expect.objectContaining({ deliveryStatus: 'sent', fileName: 'edited.xlsx', version: 2 }),
    ])
  })
})
