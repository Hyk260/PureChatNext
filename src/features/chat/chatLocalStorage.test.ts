import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CHAT_MESSAGES_STORAGE_KEY,
  claimPendingChatText,
  claimPendingTopicSend,
  clearDraftMessages,
  clearMessages,
  createTopicFromDraft,
  finishPendingTopicSend,
  listTopicsForAgent,
  loadMessages,
  loadTopics,
  messagesStorageKey,
  saveMessages,
  saveTopics,
  setPendingChatText,
  setPendingTopicSend,
  touchTopic,
  truncateTitle,
} from './chatLocalStorage'

const TEST_AGENT = 'test-agent'

describe('chatLocalStorage', () => {
  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    finishPendingTopicSend()
    vi.restoreAllMocks()
  })

  it('returns empty array when storage is empty', () => {
    expect(loadMessages(TEST_AGENT, null)).toEqual([])
  })

  it('round-trips UI messages', () => {
    const messages = [
      {
        id: 'msg-1',
        parts: [{ text: 'hello', type: 'text' as const }],
        role: 'user' as const,
      },
    ]

    saveMessages(TEST_AGENT, null, messages)
    expect(localStorage.getItem(messagesStorageKey(TEST_AGENT, null))).toBeTruthy()
    expect(loadMessages(TEST_AGENT, null)).toEqual(messages)
  })

  it('returns empty array for invalid JSON', () => {
    localStorage.setItem(messagesStorageKey(TEST_AGENT, null), '{not-json')
    expect(loadMessages(TEST_AGENT, null)).toEqual([])
  })

  it('returns empty array for non-array payload', () => {
    localStorage.setItem(
      messagesStorageKey(TEST_AGENT, null),
      JSON.stringify({ ok: true }),
    )
    expect(loadMessages(TEST_AGENT, null)).toEqual([])
  })

  it('swallows quota errors on save', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })

    expect(() =>
      saveMessages(TEST_AGENT, null, [
        {
          id: 'msg-1',
          parts: [{ text: 'hello', type: 'text' }],
          role: 'user',
        },
      ]),
    ).not.toThrow()
  })

  it('clearMessages only removes legacy v1 key', () => {
    localStorage.setItem(
      CHAT_MESSAGES_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'legacy-1',
          parts: [{ text: 'legacy', type: 'text' as const }],
          role: 'user' as const,
        },
      ]),
    )
    saveMessages(TEST_AGENT, null, [
      {
        id: 'v2-1',
        parts: [{ text: 'draft', type: 'text' as const }],
        role: 'user' as const,
      },
    ])

    clearMessages()

    expect(localStorage.getItem(CHAT_MESSAGES_STORAGE_KEY)).toBeNull()
    expect(loadMessages(TEST_AGENT, null)).toHaveLength(1)
  })

  it('claims pending chat text once', () => {
    setPendingChatText('  start chat  ')
    expect(claimPendingChatText()).toBe('start chat')
    expect(claimPendingChatText()).toBeNull()
  })

  it('ignores empty pending chat text', () => {
    setPendingChatText('   ')
    expect(claimPendingChatText()).toBeNull()
  })

  it('claims pending topic send once', () => {
    setPendingTopicSend('  hello topic  ')
    expect(claimPendingTopicSend()).toBe('hello topic')
    expect(claimPendingTopicSend()).toBeNull()
    finishPendingTopicSend()
    expect(claimPendingTopicSend()).toBeNull()
  })

  it('ignores empty pending topic send', () => {
    setPendingTopicSend('   ')
    expect(claimPendingTopicSend()).toBeNull()
  })
})

describe('chatLocalStorage v2 buckets', () => {
  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    finishPendingTopicSend()
  })

  it('builds distinct keys for draft vs topic', () => {
    expect(messagesStorageKey('zen-master', null)).toBe(
      'purechat:chat:v2:messages:zen-master:draft',
    )
    expect(messagesStorageKey('zen-master', 't1')).toBe(
      'purechat:chat:v2:messages:zen-master:t1',
    )
  })

  it('isolates messages by topic bucket', () => {
    const draftMsg = [
      {
        id: 'd1',
        parts: [{ text: 'draft', type: 'text' as const }],
        role: 'user' as const,
      },
    ]
    const topicMsg = [
      {
        id: 't1',
        parts: [{ text: 'topic', type: 'text' as const }],
        role: 'user' as const,
      },
    ]
    saveMessages('zen-master', null, draftMsg)
    saveMessages('zen-master', 'topic-a', topicMsg)
    expect(loadMessages('zen-master', null)).toEqual(draftMsg)
    expect(loadMessages('zen-master', 'topic-a')).toEqual(topicMsg)
  })

  it('createTopicFromDraft moves draft messages and appends topic meta', () => {
    saveMessages('zen-master', null, [
      {
        id: 'm1',
        parts: [{ text: '你好世界这是一段很长的标题测试内容', type: 'text' as const }],
        role: 'user' as const,
      },
    ])
    const topic = createTopicFromDraft({
      agentId: 'zen-master',
      titleFrom: '你好世界这是一段很长的标题测试内容',
      topicId: 'fixed-topic-id',
    })
    expect(topic.id).toBe('fixed-topic-id')
    expect(topic.agentId).toBe('zen-master')
    expect(topic.title.length).toBeLessThanOrEqual(30)
    expect(loadMessages('zen-master', null)).toEqual([])
    expect(loadMessages('zen-master', 'fixed-topic-id')).toHaveLength(1)
    expect(loadTopics().some((t) => t.id === 'fixed-topic-id')).toBe(true)
  })

  it('migrates legacy v1 messages into draft bucket and removes v1 key', () => {
    const legacyMsg = [
      {
        id: 'legacy-1',
        parts: [{ text: 'from v1', type: 'text' as const }],
        role: 'user' as const,
      },
    ]
    localStorage.setItem(CHAT_MESSAGES_STORAGE_KEY, JSON.stringify(legacyMsg))

    expect(loadMessages('zen-master', null)).toEqual(legacyMsg)
    expect(localStorage.getItem(CHAT_MESSAGES_STORAGE_KEY)).toBeNull()
    expect(loadMessages('zen-master', null)).toEqual(legacyMsg)
  })

  it('clearDraftMessages only clears draft bucket', () => {
    saveMessages('zen-master', null, [
      {
        id: 'd1',
        parts: [{ text: 'x', type: 'text' as const }],
        role: 'user' as const,
      },
    ])
    saveMessages('zen-master', 'keep', [
      {
        id: 'k1',
        parts: [{ text: 'y', type: 'text' as const }],
        role: 'user' as const,
      },
    ])
    clearDraftMessages('zen-master')
    expect(loadMessages('zen-master', null)).toEqual([])
    expect(loadMessages('zen-master', 'keep')).toHaveLength(1)
  })

  it('listTopicsForAgent filters by agent and sorts by updatedAt desc', () => {
    saveTopics([
      { id: 'a1', agentId: 'agent-a', title: 'Old', updatedAt: 100 },
      { id: 'a2', agentId: 'agent-a', title: 'New', updatedAt: 300 },
      { id: 'b1', agentId: 'agent-b', title: 'Other', updatedAt: 200 },
    ])

    expect(listTopicsForAgent('agent-a').map((t) => t.id)).toEqual(['a2', 'a1'])
    expect(listTopicsForAgent('agent-b').map((t) => t.id)).toEqual(['b1'])
  })

  it('touchTopic bumps updatedAt', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2020-01-01'))

    saveTopics([{ id: 't1', agentId: 'agent-a', title: 'Topic', updatedAt: 100 }])

    vi.setSystemTime(new Date('2020-01-02'))
    touchTopic('t1')

    expect(loadTopics().find((t) => t.id === 't1')?.updatedAt).toBe(
      new Date('2020-01-02').getTime(),
    )

    vi.useRealTimers()
  })

  it('touchTopic is no-op for missing id', () => {
    const topics = [{ id: 't1', agentId: 'agent-a', title: 'Topic', updatedAt: 100 }]
    saveTopics(topics)

    touchTopic('missing')

    expect(loadTopics()).toEqual(topics)
  })
})

describe('truncateTitle', () => {
  it('returns fallback for empty input', () => {
    expect(truncateTitle('')).toBe('新话题')
    expect(truncateTitle('   ')).toBe('新话题')
  })

  it('truncates long strings to 30 chars with ellipsis', () => {
    const result = truncateTitle('你好世界这是一段很长的标题测试内容abcdefghijklmnop')

    expect(result.length).toBe(30)
    expect(result.endsWith('…')).toBe(true)
  })
})
