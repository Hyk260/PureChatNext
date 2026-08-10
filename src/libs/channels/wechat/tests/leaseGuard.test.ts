import { describe, expect, it, vi } from 'vitest'

import { sendWithValidWechatEventLease } from '../leaseGuard'

describe('sendWithValidWechatEventLease', () => {
  it('does not send after the worker loses its lease', async () => {
    const send = vi.fn()

    await expect(
      sendWithValidWechatEventLease({
        eventId: 'event-1',
        hasValidLease: vi.fn().mockResolvedValue(false),
        owner: 'old-worker',
        send,
      })
    ).rejects.toThrow('Event lease lost')

    expect(send).not.toHaveBeenCalled()
  })
})
