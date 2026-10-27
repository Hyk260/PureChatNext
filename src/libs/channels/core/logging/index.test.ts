import { describe, expect, it } from 'vitest'

import { CHANNEL_MESSAGE_KIND_LABEL } from '@pure/const'

import { formatInboundVisibleContent } from './index'

describe('channel inbound log content', () => {
  it('flattens, truncates and JSON-escapes text and commands', () => {
    expect(formatInboundVisibleContent({ content: 'a\n\t"b', messageKind: 'text' })).toBe(
      '，内容=' + JSON.stringify('a "b')
    )
    const content = 'x'.repeat(201)
    expect(formatInboundVisibleContent({ content, messageKind: 'command' })).toBe(
      `，内容=${JSON.stringify(content.slice(0, 200))}`
    )
  })

  it('preserves media placeholders and unknown-kind fallbacks', () => {
    expect(CHANNEL_MESSAGE_KIND_LABEL.audio).toBe('语音')
    expect(formatInboundVisibleContent({ content: 'private', messageKind: 'image' })).toBe('，内容=[图片]')
    expect(formatInboundVisibleContent({ content: 'private', messageKind: 'unknown' })).toBe('')
  })
})
