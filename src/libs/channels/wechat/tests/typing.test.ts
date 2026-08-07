import { describe, expect, it, vi } from 'vitest'

import { startWechatTyping } from '../typing'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('startWechatTyping', () => {
  it('starts and best-effort stops with the fetched typing ticket', async () => {
    const getConfig = vi.fn().mockResolvedValue({ typing_ticket: 'ticket-1' })
    const sendTyping = vi.fn().mockResolvedValue(undefined)
    const stop = startWechatTyping({ getConfig, sendTyping }, 'user-1', 'context-1')

    await flush()
    expect(getConfig).toHaveBeenCalledWith('user-1', 'context-1')
    expect(sendTyping).toHaveBeenCalledWith('user-1', 'ticket-1', true)

    stop()
    await flush()
    expect(sendTyping).toHaveBeenLastCalledWith('user-1', 'ticket-1', false)
  })

  it('skips a late start but still sends stop when generation aborts before getconfig resolves', async () => {
    let resolveConfig!: (value: { typing_ticket: string }) => void
    const getConfig = vi.fn().mockReturnValue(
      new Promise<{ typing_ticket: string }>((resolve) => {
        resolveConfig = resolve
      })
    )
    const sendTyping = vi.fn().mockResolvedValue(undefined)
    const stop = startWechatTyping({ getConfig, sendTyping }, 'user-1', 'context-1')

    stop()
    resolveConfig({ typing_ticket: 'ticket-1' })
    await flush()

    expect(sendTyping).toHaveBeenCalledTimes(1)
    expect(sendTyping).toHaveBeenCalledWith('user-1', 'ticket-1', false)
  })

  it('swallows getconfig failures', async () => {
    const getConfig = vi.fn().mockRejectedValue(new Error('network'))
    const sendTyping = vi.fn()
    const stop = startWechatTyping({ getConfig, sendTyping }, 'user-1', 'context-1')

    stop()
    await expect(flush()).resolves.toBeUndefined()
    expect(sendTyping).not.toHaveBeenCalled()
  })

  it('swallows start and stop sendtyping failures', async () => {
    const getConfig = vi.fn().mockResolvedValue({ typing_ticket: 'ticket-1' })
    const sendTyping = vi.fn().mockRejectedValue(new Error('network'))
    const stop = startWechatTyping({ getConfig, sendTyping }, 'user-1', 'context-1')

    await flush()
    stop()
    await expect(flush()).resolves.toBeUndefined()
    expect(sendTyping).toHaveBeenCalledTimes(2)
  })
})
