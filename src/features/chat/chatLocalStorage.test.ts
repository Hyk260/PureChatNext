import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CHAT_MESSAGES_STORAGE_KEY,
  clearMessages,
  loadMessages,
  saveMessages,
} from './chatLocalStorage'

describe('chatLocalStorage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('returns empty array when storage is empty', () => {
    expect(loadMessages()).toEqual([])
  })

  it('round-trips UI messages', () => {
    const messages = [
      {
        id: 'msg-1',
        parts: [{ text: 'hello', type: 'text' as const }],
        role: 'user' as const,
      },
    ]

    saveMessages(messages)
    expect(localStorage.getItem(CHAT_MESSAGES_STORAGE_KEY)).toBeTruthy()
    expect(loadMessages()).toEqual(messages)
  })

  it('returns empty array for invalid JSON', () => {
    localStorage.setItem(CHAT_MESSAGES_STORAGE_KEY, '{not-json')
    expect(loadMessages()).toEqual([])
  })

  it('returns empty array for non-array payload', () => {
    localStorage.setItem(CHAT_MESSAGES_STORAGE_KEY, JSON.stringify({ ok: true }))
    expect(loadMessages()).toEqual([])
  })

  it('swallows quota errors on save', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })

    expect(() =>
      saveMessages([
        {
          id: 'msg-1',
          parts: [{ text: 'hello', type: 'text' }],
          role: 'user',
        },
      ]),
    ).not.toThrow()
  })

  it('clearMessages empties storage', () => {
    saveMessages([
      {
        id: 'msg-1',
        parts: [{ text: 'hello', type: 'text' as const }],
        role: 'user' as const,
      },
    ])
    clearMessages()
    expect(loadMessages()).toEqual([])
  })
})
