import { afterEach, describe, expect, it, vi } from 'vitest'

const { mockGetRedisConfig, mockInitializeRedis, mockIsRedisEnabled } = vi.hoisted(() => ({
  mockGetRedisConfig: vi.fn(),
  mockInitializeRedis: vi.fn(),
  mockIsRedisEnabled: vi.fn(),
}))

vi.mock('@/envs/redis', () => ({
  getRedisConfig: mockGetRedisConfig,
}))

vi.mock('@/libs/redis', () => ({
  initializeRedis: mockInitializeRedis,
  isRedisEnabled: mockIsRedisEnabled,
}))

describe('createSecondaryStorage', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns undefined when redis is disabled', async () => {
    mockGetRedisConfig.mockReturnValue({ enabled: false, prefix: 'purechat', tls: false, url: '' })
    mockIsRedisEnabled.mockReturnValue(false)

    const { createSecondaryStorage } = await import('./create-secondary-storage')
    expect(createSecondaryStorage()).toBeUndefined()
  })

  it('prefixes keys and forwards get/set/delete to redis', async () => {
    mockGetRedisConfig.mockReturnValue({
      enabled: true,
      prefix: 'purechat',
      tls: false,
      url: 'redis://localhost:6379',
    })
    mockIsRedisEnabled.mockReturnValue(true)

    const redis = {
      del: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue('value'),
      set: vi.fn().mockResolvedValue('OK'),
    }
    mockInitializeRedis.mockResolvedValue(redis)

    const { createSecondaryStorage } = await import('./create-secondary-storage')
    const storage = createSecondaryStorage()
    expect(storage).toBeDefined()

    await expect(storage!.get('session:1')).resolves.toBe('value')
    expect(redis.get).toHaveBeenCalledWith('better-auth:session:1')

    await storage!.set('session:1', 'payload', 60)
    expect(redis.set).toHaveBeenCalledWith('better-auth:session:1', 'payload', { ex: 60 })

    await storage!.set('session:2', 'payload')
    expect(redis.set).toHaveBeenCalledWith('better-auth:session:2', 'payload')

    await storage!.delete('session:1')
    expect(redis.del).toHaveBeenCalledWith('better-auth:session:1')
  })
})
