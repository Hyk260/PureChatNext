import { afterEach, describe, expect, it } from 'vitest'

import {
  claimPendingChatProject,
  claimPendingChatText,
  claimPendingTopicSend,
  finishPendingTopicSend,
  getPendingChatPermissionMode,
  setPendingChatPermissionMode,
  setPendingChatProject,
  setPendingChatText,
  setPendingTopicSend,
  truncateTitle,
} from '../chatLocalStorage'

describe('chatLocalStorage pending helpers', () => {
  afterEach(() => {
    sessionStorage.clear()
    finishPendingTopicSend()
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

  it('stores a valid pending permission mode and defaults invalid values', () => {
    setPendingChatPermissionMode('full')
    expect(getPendingChatPermissionMode()).toBe('full')

    sessionStorage.setItem('purechat:chat:v1:pending-permission-mode', 'invalid')
    expect(getPendingChatPermissionMode()).toBe('auto')
  })

  it('claims pending chat project once', () => {
    setPendingChatProject({ name: ' Demo ', rootPath: ' /tmp/demo ' })
    expect(claimPendingChatProject()).toEqual({ name: 'Demo', rootPath: '/tmp/demo' })
    expect(claimPendingChatProject()).toBeNull()
  })

  it('clears pending chat project when set to null', () => {
    setPendingChatProject({ name: 'Demo', rootPath: '/tmp/demo' })
    setPendingChatProject(null)
    expect(claimPendingChatProject()).toBeNull()
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
