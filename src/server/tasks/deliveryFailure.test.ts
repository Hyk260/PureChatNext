import { describe, expect, it } from 'vitest'
import { QQActiveMessageError } from '@pure/chat-adapter/qq'

import { taskDeliveryFailure } from './deliveryFailure'

describe('QQ task delivery failures', () => {
  it('does not automatically resend an uncertain push', () => {
    const result = taskDeliveryFailure(new QQActiveMessageError('请求结果不确定', 'unknown'), 'qq')

    expect(result.status).toBe('unknown')
  })

  it('retries explicit QQ rate limits', () => {
    const result = taskDeliveryFailure(new QQActiveMessageError('QQ 主动推送被拒绝', 'rejected', 40034100, 400), 'qq')

    expect(result.status).toBe('retry')
  })

  it('asks for platform configuration when QQ rejects permission', () => {
    const result = taskDeliveryFailure(new QQActiveMessageError('QQ 主动推送被拒绝', 'rejected', 40034105, 403), 'qq')

    expect(result.status).toBe('action_required')
    expect(result.error).toContain('主动消息权限')
  })
})
