import { describe, expect, it } from 'vitest'

import { formatQQInboundLog, resolveQQInboundKind } from './inboundLog'

describe('resolveQQInboundKind', () => {
  it('prefers attachments over caption text', () => {
    expect(resolveQQInboundKind({ attachments: [{ type: 'image' }], text: 'hi' })).toBe('image')
    expect(resolveQQInboundKind({ attachments: [{ type: 'file' }] })).toBe('file')
    expect(resolveQQInboundKind({ attachments: [{ type: 'video' }] })).toBe('video')
    expect(resolveQQInboundKind({ attachments: [{ type: 'audio' }] })).toBe('audio')
  })

  it('classifies commands, text, and empty payloads', () => {
    expect(resolveQQInboundKind({ text: '/help' })).toBe('command')
    expect(resolveQQInboundKind({ text: 'hello' })).toBe('text')
    expect(resolveQQInboundKind({})).toBe('unsupported')
  })
})

describe('formatQQInboundLog', () => {
  it('hashes contacts and includes truncated text', () => {
    const inboundLog = formatQQInboundLog({
      applicationId: 'app-1',
      content: 'hello',
      externalUserId: 'qq-openid-secret',
      messageKind: 'text',
    })
    expect(inboundLog).toContain('[QQ Gateway] 收到文本消息')
    expect(inboundLog).toContain('应用=app-1')
    expect(inboundLog).toContain('联系人=sha256:')
    expect(inboundLog).toContain('长度=5')
    expect(inboundLog).toContain('内容="hello"')
    expect(inboundLog).not.toContain('qq-openid-secret')
  })

  it('uses media placeholders and command labels', () => {
    expect(
      formatQQInboundLog({
        applicationId: 'app-1',
        content: '',
        externalUserId: 'u1',
        messageKind: 'image',
      })
    ).toContain('内容=[图片]')
    expect(
      formatQQInboundLog({
        applicationId: 'app-1',
        content: '/ping',
        externalUserId: 'u1',
        messageKind: 'command',
      })
    ).toContain('收到指令消息')
  })
})
