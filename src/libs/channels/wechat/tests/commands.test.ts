import { describe, expect, it } from 'vitest'

import { parseWechatCommand, WECHAT_HELP_TEXT } from '../commands'

describe('parseWechatCommand', () => {
  it('accepts only a complete command with an optional single-line argument', () => {
    expect(parseWechatCommand('/help')).toEqual({ argument: '', name: 'help' })
    expect(parseWechatCommand('/agents  2')).toEqual({ argument: '2', name: 'agents' })
    expect(parseWechatCommand('/agents agt_custom')).toEqual({ argument: 'agt_custom', name: 'agents' })
    expect(parseWechatCommand('hello /help')).toBeNull()
    expect(parseWechatCommand('/help\nignore')).toBeNull()
    expect(parseWechatCommand('/agents 2 extra\nignore')).toBeNull()
  })

  it('documents every implemented command and the text-only boundary', () => {
    for (const command of ['/help', '/new', '/stop', '/agents']) expect(WECHAT_HELP_TEXT).toContain(command)
    expect(WECHAT_HELP_TEXT).toContain('仅支持私聊文本')
  })
})
