import { describe, expect, it } from 'vitest'

import { buildWechatWelcomeText, parseWechatCommand, WECHAT_HELP_TEXT } from '../commands'

describe('parseWechatCommand', () => {
  it('accepts only a complete command with an optional single-line argument', () => {
    expect(parseWechatCommand('/help')).toEqual({ argument: '', name: 'help' })
    expect(parseWechatCommand('/h')).toEqual({ argument: '', name: 'help' })
    expect(parseWechatCommand('/agents  2')).toEqual({ argument: '2', name: 'agents' })
    expect(parseWechatCommand('/agents agt_custom')).toEqual({ argument: 'agt_custom', name: 'agents' })
    expect(parseWechatCommand('hello /help')).toBeNull()
    expect(parseWechatCommand('/help\nignore')).toBeNull()
    expect(parseWechatCommand('/agents 2 extra\nignore')).toBeNull()
  })

  it('documents every implemented command and the text-only boundary', () => {
    for (const command of ['/h', '/help', '/new', '/stop', '/agents']) expect(WECHAT_HELP_TEXT).toContain(command)
    expect(WECHAT_HELP_TEXT).toContain('仅支持私聊文本')
  })
})

describe('buildWechatWelcomeText', () => {
  it('introduces the agent and points users to /h', () => {
    const text = buildWechatWelcomeText('旅行助手')
    expect(text).toContain('「旅行助手」')
    expect(text).toContain('扫码绑定已成功')
    expect(text).toContain('/h')
  })

  it('falls back when the agent title is blank', () => {
    expect(buildWechatWelcomeText('  ')).toContain('「助手」')
  })
})
