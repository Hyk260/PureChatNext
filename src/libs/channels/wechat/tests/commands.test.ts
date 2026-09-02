import { describe, expect, it } from 'vitest'

import { WECHAT_HELP_TEXT } from '../commands'

describe('WECHAT_HELP_TEXT', () => {
  it('documents every implemented command and the text-only boundary', () => {
    for (const command of ['/h', '/help', '/new', '/stop', '/agents']) expect(WECHAT_HELP_TEXT).toContain(command)
    expect(WECHAT_HELP_TEXT).toContain('仅支持私聊文本')
  })
})
