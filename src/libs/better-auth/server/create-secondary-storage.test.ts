import { afterEach, describe, expect, it, vi } from 'vitest'

const { mockGetRedisConfig, mockInitializeRedis, mockIsRedisEnabled, mockResetRedisClient } = vi.hoisted(() => ({
  mockGetRedisConfig: vi.fn(),
  mockInitializeRedis: vi.fn(),
  mockIsRedisEnabled: vi.fn(),
  mockResetRedisClient: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/envs/redis', () => ({
  getRedisConfig: mockGetRedisConfig,
}))

vi.mock('@/libs/redis', () => ({
  initializeRedis: mockInitializeRedis,
  isRedisEnabled: mockIsRedisEnabled,
  resetRedisClient: mockResetRedisClient,
}))

const enableRedis = () => {
  mockGetRedisConfig.mockReturnValue({
    enabled: true,
    prefix: 'purechat',
    tls: false,
    url: 'redis://localhost:6379',
  })
  mockIsRedisEnabled.mockReturnValue(true)
}

describe('createSecondaryStorage', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.useRealTimers()
  })

  it('returns undefined when redis is disabled', async () => {
    mockGetRedisConfig.mockReturnValue({ enabled: false, prefix: 'purechat', tls: false, url: '' })
    mockIsRedisEnabled.mockReturnValue(false)

    const { createSecondaryStorage } = await import('./create-secondary-storage')
    expect(createSecondaryStorage()).toBeUndefined()
  })

  it('prefixes keys and forwards get/set/delete to redis', async () => {
    enableRedis()

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

  it('returns null on get when redis initialize fails', async () => {
    enableRedis()
    mockInitializeRedis.mockRejectedValue(new Error('connect ETIMEDOUT'))

    const { createSecondaryStorage } = await import('./create-secondary-storage')
    const storage = createSecondaryStorage()

    await expect(storage!.get('session:1')).resolves.toBeNull()
    expect(mockResetRedisClient).toHaveBeenCalled()
  })

  it('returns null on get when redis command fails', async () => {
    enableRedis()
    const redis = {
      del: vi.fn(),
      get: vi.fn().mockRejectedValue(new Error('Command timed out')),
      set: vi.fn(),
    }
    mockInitializeRedis.mockResolvedValue(redis)

    const { createSecondaryStorage } = await import('./create-secondary-storage')
    const storage = createSecondaryStorage()

    await expect(storage!.get('session:1')).resolves.toBeNull()
    expect(mockResetRedisClient).toHaveBeenCalled()
  })

  it('swallows set/delete errors so auth flow can continue', async () => {
    enableRedis()
    const redis = {
      del: vi.fn().mockRejectedValue(new Error('Command timed out')),
      get: vi.fn(),
      set: vi.fn().mockRejectedValue(new Error('Command timed out')),
    }
    mockInitializeRedis.mockResolvedValue(redis)

    const { createSecondaryStorage } = await import('./create-secondary-storage')
    const storage = createSecondaryStorage()

    await expect(storage!.set('session:1', 'payload', 60)).resolves.toBeUndefined()
    await expect(storage!.delete('session:1')).resolves.toBeUndefined()
  })

  it('opens a cooldown circuit after failure to avoid repeated redis waits', async () => {
    vi.useFakeTimers()
    enableRedis()

    const redis = {
      del: vi.fn(),
      get: vi.fn().mockRejectedValueOnce(new Error('Command timed out')).mockResolvedValueOnce('recovered'),
      set: vi.fn(),
    }
    mockInitializeRedis.mockResolvedValue(redis)

    const { createSecondaryStorage } = await import('./create-secondary-storage')
    const storage = createSecondaryStorage()

    await expect(storage!.get('session:1')).resolves.toBeNull()
    expect(redis.get).toHaveBeenCalledTimes(1)

    // Circuit open: skip redis entirely
    await expect(storage!.get('session:1')).resolves.toBeNull()
    expect(redis.get).toHaveBeenCalledTimes(1)
    expect(mockInitializeRedis).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30_000)

    await expect(storage!.get('session:1')).resolves.toBe('recovered')
    expect(redis.get).toHaveBeenCalledTimes(2)
  })
})
