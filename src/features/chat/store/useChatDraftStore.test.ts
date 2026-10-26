import { afterEach, describe, expect, it } from 'vitest'

import { getChatDraftKey, useChatDraftStore } from './useChatDraftStore'

afterEach(() => {
  useChatDraftStore.setState({ texts: {}, files: {}, browserSelections: {} })
  localStorage.clear()
})

describe('browser context drafts', () => {
  it('isolates selections by agent and topic, removes selections, and never persists page data', () => {
    const first = getChatDraftKey('agent', 'first')
    const second = getChatDraftKey('agent', 'second')
    const store = useChatDraftStore.getState()
    const selection = {
      id: 'one',
      url: 'https://example.com',
      pageTitle: 'Private',
      tag: 'p',
      selector: '#p',
      text: 'private content',
      html: '',
    }
    store.setBrowserSelections(first, [selection])
    store.setText(second, 'question')
    expect(useChatDraftStore.getState().browserSelections[second]).toBeUndefined()
    expect(localStorage.getItem('purechat:chat:v1:drafts')).not.toContain('private content')
    store.clearDrafts([first])
    expect(useChatDraftStore.getState().browserSelections[first]).toBeUndefined()
    expect(useChatDraftStore.getState().texts[second]).toBe('question')
  })
})
