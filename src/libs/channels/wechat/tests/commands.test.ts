import { describe, expect, it } from 'vitest'

import { parseChannelCommand } from '../../core/commands'
import { buildWechatWelcomeText, parseWechatCommand, WECHAT_HELP_TEXT } from '../commands'

describe('wechat commands facade', () => {
  it('reuses shared parseChannelCommand', () => {
    expect(parseWechatCommand).toBe(parseChannelCommand)
    expect(parseWechatCommand('/h')).toEqual({ argument: '', name: 'help' })
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
