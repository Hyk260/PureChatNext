import { describe, expect, it } from 'vitest'

import {
  getPureChatStreamErrorMessage,
  isPureChatRestrictedModelError,
  PURECHAT_MODEL_UNAVAILABLE_MESSAGE,
} from './gatewayError'

describe('PureChat Gateway error mapping', () => {
  it('recognizes the free-tier restricted-model response', () => {
    const error = Object.assign(new Error('Free tier users do not have access to this model.'), {
      responseBody: JSON.stringify({
        error: { param: { name: 'RestrictedModelsError' }, type: 'no_providers_available' },
      }),
      statusCode: 403,
    })

    expect(isPureChatRestrictedModelError(error)).toBe(true)
    expect(getPureChatStreamErrorMessage(error)).toBe(PURECHAT_MODEL_UNAVAILABLE_MESSAGE)
  })

  it('does not expose unexpected upstream error details', () => {
    expect(getPureChatStreamErrorMessage(new Error('provider secret response'))).toBe('模型生成失败，请稍后重试。')
  })
})
