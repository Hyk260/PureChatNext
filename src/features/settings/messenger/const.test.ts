import { describe, expect, it } from 'vitest'

import { CHANNEL_COMMAND_CATALOG } from '@/libs/channels/core/commands'

import {
  MESSENGER_COMMANDS,
  MESSENGER_DEFAULT_MODELS,
  MESSENGER_DEFAULT_PROVIDER,
  QQ_COMMANDS,
  QQ_DEFAULT_MODEL,
  QQ_DEFAULT_PROVIDER,
  WECHAT_COMMANDS,
} from './const'

describe('messenger provider defaults', () => {
  it('uses DeepSeek for new QQ connections, matching WeChat', () => {
    expect(QQ_DEFAULT_PROVIDER).toBe('deepseek')
    expect(QQ_DEFAULT_MODEL).toBe(MESSENGER_DEFAULT_MODELS.deepseek)
    expect(QQ_DEFAULT_PROVIDER).toBe(MESSENGER_DEFAULT_PROVIDER)
  })

  it('keeps the existing WeChat default unchanged', () => {
    expect(MESSENGER_DEFAULT_PROVIDER).toBe('deepseek')
  })
})

describe('messenger commands catalog', () => {
  it('shares one catalog with the channel gateway', () => {
    expect(MESSENGER_COMMANDS).toBe(CHANNEL_COMMAND_CATALOG)
    expect(QQ_COMMANDS).toBe(MESSENGER_COMMANDS)
    expect(WECHAT_COMMANDS).toBe(MESSENGER_COMMANDS)
    expect(MESSENGER_COMMANDS.map((item) => item.name)).toEqual(['agents', 'new', 'stop', 'help'])
  })
})
