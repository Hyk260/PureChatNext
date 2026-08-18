import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChatBotRegistry } from './chatBotRegistry'

type FakeChat = {
  initialize: ReturnType<typeof vi.fn>
  shutdown: ReturnType<typeof vi.fn>
  id: string
}

const createFakeChat = (id: string): FakeChat => ({
  id,
  initialize: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
})

describe('ChatBotRegistry', () => {
  let registry: ChatBotRegistry<FakeChat>

  beforeEach(() => {
    registry = new ChatBotRegistry()
  })

  it('reuses an initialized bot for the same platform, application, and fingerprint', async () => {
    const first = createFakeChat('first')
    const create = vi.fn(() => first)
    const params = { applicationId: 'app-1', fingerprint: 'v1', platform: 'qq' }

    const result1 = await registry.getOrCreate(params, create)
    const result2 = await registry.getOrCreate(params, create)

    expect(result2).toBe(result1)
    expect(create).toHaveBeenCalledOnce()
    expect(first.initialize).toHaveBeenCalledOnce()
  })

  it('shuts down the old bot before replacing it after a fingerprint change', async () => {
    const first = createFakeChat('first')
    const second = createFakeChat('second')
    const create = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)

    await registry.getOrCreate({ applicationId: 'app-1', fingerprint: 'v1', platform: 'wechat' }, create)
    const result = await registry.getOrCreate({ applicationId: 'app-1', fingerprint: 'v2', platform: 'wechat' }, create)

    expect(result).toBe(second)
    expect(first.shutdown).toHaveBeenCalledOnce()
    expect(second.initialize).toHaveBeenCalledOnce()
  })

  it('shuts down and removes a bot when invalidated', async () => {
    const chat = createFakeChat('chat')
    await registry.getOrCreate({ applicationId: 'app-1', fingerprint: 'v1', platform: 'qq' }, () => chat)

    await registry.invalidate('qq', 'app-1')
    await registry.getOrCreate({ applicationId: 'app-1', fingerprint: 'v1', platform: 'qq' }, () => createFakeChat('new'))

    expect(chat.shutdown).toHaveBeenCalledOnce()
  })
})
