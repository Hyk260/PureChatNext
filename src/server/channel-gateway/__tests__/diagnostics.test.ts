// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ append: vi.fn(), prune: vi.fn(), findById: vi.fn() }))
vi.mock('@pure/database/models/channelGatewayLog', () => ({
  ChannelGatewayLogModel: class { append = mocks.append; prune = mocks.prune },
}))
vi.mock('@pure/database/models/channelBinding', () => ({
  ChannelBindingModel: class { findById = mocks.findById },
}))

import { pruneChannelGatewayLogs, recordBindingGatewayLog, recordChannelGatewayLog } from '../diagnostics'

describe('nonfatal channel diagnostics', () => {
  beforeEach(() => vi.resetAllMocks())

  it('resolves normally when the database write or maintenance fails', async () => {
    mocks.append.mockRejectedValue(new Error('database unavailable with sensitive details'))
    mocks.prune.mockRejectedValue(new Error('database unavailable'))
    await expect(recordChannelGatewayLog({ userId: 'owner', platform: 'qq', event: 'starting' })).resolves.toBeUndefined()
    await expect(pruneChannelGatewayLogs()).resolves.toBeUndefined()
  })

  it('attributes background errors to the binding owner and ignores missing/unsupported bindings', async () => {
    mocks.findById.mockResolvedValueOnce({ userId: 'owner', platform: 'wechat' }).mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userId: 'other', platform: 'unknown' }).mockRejectedValueOnce(new Error('database down'))
    for (const id of ['binding', 'deleted', 'unsupported', 'failed']) {
      await expect(recordBindingGatewayLog(id, { event: 'send_failed', code: 'ECONNRESET' })).resolves.toBeUndefined()
    }
    expect(mocks.append).toHaveBeenCalledExactlyOnceWith({ userId: 'owner', platform: 'wechat', bindingId: 'binding', event: 'send_failed', code: 'ECONNRESET' })
  })
})
