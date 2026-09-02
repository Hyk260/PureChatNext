// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn() }))

import { FileModel, FileStorageQuotaExceededError } from '../file'
import type { ChatDatabase } from '../../type'

const fileParams = {
  fileType: 'text/plain',
  name: 'test.txt',
  size: 5,
  url: 'https://storage.example/test.txt',
}

const createSelectChain = (result: unknown[], onLock?: () => void) => {
  const chain: Record<string, unknown> = {}
  chain.from = vi.fn(() => chain)
  chain.where = vi.fn(() => chain)
  chain.for = vi.fn(async () => {
    onLock?.()
    return result
  })
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

const createQuotaDb = (usedBytes: number) => {
  const events: string[] = []
  let selectIndex = 0
  const tx = {
    insert: vi.fn(() => {
      events.push('insert')
      const chain: Record<string, unknown> = {}
      chain.values = vi.fn(() => chain)
      chain.returning = vi.fn(async () => [{ id: 'file-1' }])
      return chain
    }),
    select: vi.fn(() => {
      const isLock = selectIndex++ === 0
      return createSelectChain(
        isLock ? [{ id: 'user-1' }] : [{ usedBytes }],
        isLock ? () => events.push('lock') : undefined
      )
    }),
  }
  const db = {
    transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
  } as unknown as ChatDatabase
  return { db, events, tx }
}

describe('FileModel storage quota', () => {
  it('returns zero when the user has no stored files', async () => {
    const db = {
      select: vi.fn(() => createSelectChain([{ usedBytes: null }])),
    } as unknown as ChatDatabase

    await expect(new FileModel('user-1', db).getStorageUsage()).resolves.toBe(0)
  })

  it('returns the summed logical file size', async () => {
    const db = {
      select: vi.fn(() => createSelectChain([{ usedBytes: '1536' }])),
    } as unknown as ChatDatabase

    await expect(new FileModel('user-1', db).getStorageUsage()).resolves.toBe(1536)
  })

  it('allows a file that exactly reaches the limit after locking the user', async () => {
    const { db, events } = createQuotaDb(10)

    await expect(new FileModel('user-1', db).createWithinStorageLimit(fileParams, 15)).resolves.toEqual({
      id: 'file-1',
    })
    expect(events).toEqual(['lock', 'insert'])
  })

  it('rejects a file that exceeds the limit by one byte', async () => {
    const { db, tx } = createQuotaDb(11)

    await expect(new FileModel('user-1', db).createWithinStorageLimit(fileParams, 15)).rejects.toEqual(
      new FileStorageQuotaExceededError(11, 15, 5)
    )
    expect(tx.insert).not.toHaveBeenCalled()
  })
})
