import { describe, expect, it } from 'vitest'

import {
  MESSENGER_DEFAULT_MODELS,
  MESSENGER_DEFAULT_PROVIDER,
  QQ_DEFAULT_MODEL,
  QQ_DEFAULT_PROVIDER,
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
