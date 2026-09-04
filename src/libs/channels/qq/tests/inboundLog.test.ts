import { describe, expect, it } from 'vitest'

import { formatQQAttachmentContext, formatQQInboundLog, formatQQUnsupportedMessage, resolveQQInboundKind } from '../inboundLog'

describe('QQ_UNSUPPORTED_MESSAGE', () => {
  it('builds a message for the actual unsupported media type', () => {
    expect(formatQQUnsupportedMessage('audio')).toContain('不支持语音消息')
    expect(formatQQUnsupportedMessage('video')).toContain('不支持视频消息')
  })
})

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

describe('formatQQAttachmentContext', () => {
  it('formats attachment metadata for agent input', () => {
    expect(
      formatQQAttachmentContext([{ mimeType: 'application/pdf', name: 'report.pdf', size: 2048, type: 'file' }])
    ).toBe('[附件: report.pdf, application/pdf, 2048 bytes]')
  })

  it('returns undefined for an empty attachment list', () => {
    expect(formatQQAttachmentContext()).toBeUndefined()
  })
})
