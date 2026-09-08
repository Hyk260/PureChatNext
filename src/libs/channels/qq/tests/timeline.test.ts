import { describe, expect, it } from 'vitest'

import type { ChannelTimelineEvent } from '@pure/database/models/channelEvent'

import { expandQQEventsToMessages } from '../timeline'

function event(overrides: Partial<ChannelTimelineEvent>): ChannelTimelineEvent {
  return {
    attachments: [],
    completedAt: null,
    content: '',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    durationMs: null,
    id: 'event-1',
    lastErrorCode: null,
    lastErrorMessage: null,
    messageKind: 'text',
    model: null,
    platformPayload: null,
    provider: null,
    responseText: null,
    status: 'completed',
    ...overrides,
  }
}

describe('expandQQEventsToMessages', () => {
  it('expands a text inbound event and its model response', () => {
    const messages = expandQQEventsToMessages([
      event({
        content: '你好',
        model: 'deepseek-v4-flash',
        provider: 'deepseek',
        responseText: '你好，有什么可以帮你？',
      }),
    ])

    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({ role: 'user', text: '你好' })
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      source: 'model',
      text: '你好，有什么可以帮你？',
    })
  })

  it('keeps per-message group authors instead of the session label', () => {
    const messages = expandQQEventsToMessages([
      event({
        content: '1',
        id: 'event-1',
        platformPayload: {
          authorId: 'user-a',
          authorName: '临江仙',
          threadId: 'qq:group:group-1',
          threadType: 'group',
        },
      }),
      event({
        content: '2',
        createdAt: new Date('2026-08-01T00:01:00.000Z'),
        id: 'event-2',
        platformPayload: {
          authorId: 'user-b',
          authorName: '染忆',
          threadId: 'qq:group:group-1',
          threadType: 'group',
        },
      }),
    ])

    expect(messages[0]).toMatchObject({ authorId: 'user-a', authorName: '临江仙', text: '1' })
    expect(messages[1]).toMatchObject({ authorId: 'user-b', authorName: '染忆', text: '2' })
  })

  it('reuses a later nickname for earlier messages from the same group member', () => {
    const messages = expandQQEventsToMessages([
      event({
        content: '1',
        id: 'event-1',
        platformPayload: {
          authorId: 'user-a',
          threadId: 'qq:group:group-1',
          threadType: 'group',
        },
      }),
      event({
        content: '3',
        createdAt: new Date('2026-08-01T00:02:00.000Z'),
        id: 'event-3',
        platformPayload: {
          authorId: 'user-a',
          authorName: '临江仙',
          threadId: 'qq:group:group-1',
          threadType: 'group',
        },
      }),
    ])

    expect(messages[0]).toMatchObject({ authorId: 'user-a', authorName: '临江仙', text: '1' })
    expect(messages[1]).toMatchObject({ authorId: 'user-a', authorName: '临江仙', text: '3' })
  })

  it('uses the session nickname for the latest unnamed group speaker', () => {
    const messages = expandQQEventsToMessages(
      [
        event({
          content: '1',
          id: 'event-1',
          platformPayload: {
            authorId: 'user-a',
            threadId: 'qq:group:group-1',
            threadType: 'group',
          },
        }),
        event({
          content: '2',
          createdAt: new Date('2026-08-01T00:01:00.000Z'),
          id: 'event-2',
          platformPayload: {
            authorId: 'user-b',
            threadId: 'qq:group:group-1',
            threadType: 'group',
          },
        }),
      ],
      { sessionUserName: '临江仙' }
    )

    expect(messages[0]).toMatchObject({ authorId: 'user-a', text: '1' })
    expect(messages[0]?.authorName).toBeUndefined()
    expect(messages[1]).toMatchObject({ authorId: 'user-b', authorName: '临江仙', text: '2' })
  })

  it('maps QQ attachment metadata to remote links', () => {
    const messages = expandQQEventsToMessages([
      event({
        content: '看这个文件',
        messageKind: 'file',
        platformPayload: {
          attachments: [
            {
              mimeType: 'application/pdf',
              name: 'report.pdf',
              size: 2048,
              type: 'file',
              url: 'https://cdn.example/report.pdf',
            },
          ],
          threadId: 'qq:c2c:user-1',
          threadType: 'c2c',
        },
      }),
    ])

    expect(messages[0]).toMatchObject({
      fileUrl: 'https://cdn.example/report.pdf',
      role: 'user',
      text: '[文件]',
    })
    expect(messages[0]?.attachments?.[0]).toMatchObject({
      fileName: 'report.pdf',
      fileSize: 2048,
      fileUrl: 'https://cdn.example/report.pdf',
    })
  })

  it('expands manual outbound messages', () => {
    const messages = expandQQEventsToMessages([
      event({
        completedAt: new Date('2026-08-01T00:01:00.000Z'),
        messageKind: 'outbound',
        responseText: '网页代发',
      }),
    ])

    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ role: 'assistant', source: 'manual', text: '网页代发' })
  })
})
