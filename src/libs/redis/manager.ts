import { IoRedisRedisProvider } from './redis'
import { type BaseRedisProvider, type RedisConfig } from './types'
import { redisEnv } from '@/envs/redis'

export const isRedisDisabledByEnv = () => redisEnv.DISABLE_REDIS

export const isRedisEnabled = (config: RedisConfig) => !isRedisDisabledByEnv() && config.enabled

const createProvider = (config: RedisConfig, prefix?: string): BaseRedisProvider | null => {
  if (!isRedisEnabled(config)) return null

  const actualPrefix = prefix ?? config.prefix
  return new IoRedisRedisProvider({ ...config, prefix: actualPrefix })
}

export class RedisManager {
  private static instance: BaseRedisProvider | null = null
  private static initPromise: Promise<BaseRedisProvider | null> | null = null

  static async initialize(config: RedisConfig): Promise<BaseRedisProvider | null> {
    if (RedisManager.instance) return RedisManager.instance
    if (RedisManager.initPromise) return RedisManager.initPromise

    RedisManager.initPromise = (async () => {
      const provider = createProvider(config)

      if (!provider) {
        RedisManager.instance = null
        return null
      }

      await provider.initialize()
      RedisManager.instance = provider

      return provider
    })().catch((error) => {
      RedisManager.initPromise = null
      throw error
    })

    return RedisManager.initPromise
  }

  static async reset() {
    if (RedisManager.instance) {
      await RedisManager.instance.disconnect()
    }

    RedisManager.instance = null
    RedisManager.initPromise = null
  }
}

export const initializeRedis = (config: RedisConfig) => RedisManager.initialize(config)
export const resetRedisClient = () => RedisManager.reset()

/**
 * 使用自定义前缀创建 Redis 客户端
 *
 * @param config - Redis 配置
 * @param prefix - 所有 key 的自定义前缀（例如 'aiGeneration'）
 * @returns Redis 客户端；若 Redis 未启用则返回 null
 */
export const createRedisWithPrefix = async (config: RedisConfig, prefix: string): Promise<BaseRedisProvider | null> => {
  const provider = createProvider(config, prefix)
  if (!provider) return null

  await provider.initialize()
  return provider
}

/**
 * 按前缀管理单例 Redis 客户端
 */
class PrefixedRedisManager {
  private static instances = new Map<string, BaseRedisProvider>()
  private static initPromises = new Map<string, Promise<BaseRedisProvider | null>>()

  static async initialize(config: RedisConfig, prefix: string): Promise<BaseRedisProvider | null> {
    const existing = this.instances.get(prefix)
    if (existing) return existing

    const pendingPromise = this.initPromises.get(prefix)
    if (pendingPromise) return pendingPromise

    const initPromise = (async () => {
      const provider = createProvider(config, prefix)
      if (!provider) return null

      await provider.initialize()
      this.instances.set(prefix, provider)
      return provider
    })().catch((error) => {
      this.initPromises.delete(prefix)
      throw error
    })

    this.initPromises.set(prefix, initPromise)
    return initPromise
  }

  static async reset(prefix?: string) {
    if (prefix) {
      const instance = this.instances.get(prefix)
      if (instance) {
        await instance.disconnect()
        this.instances.delete(prefix)
        this.initPromises.delete(prefix)
      }
    } else {
      for (const instance of this.instances.values()) {
        await instance.disconnect()
      }
      this.instances.clear()
      this.initPromises.clear()
    }
  }
}

/**
 * 使用自定义前缀初始化单例 Redis 客户端
 *
 * @param config - Redis 配置
 * @param prefix - 所有 key 的自定义前缀（例如 'aiGeneration'）
 * @returns Redis 客户端；若 Redis 未启用则返回 null
 */
export const initializeRedisWithPrefix = (config: RedisConfig, prefix: string) => {
  return PrefixedRedisManager.initialize(config, prefix)
}

export const resetPrefixedRedisClient = (prefix?: string) => PrefixedRedisManager.reset(prefix)
