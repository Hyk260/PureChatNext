import {
  type BaseRedisProvider,
  type RedisKey,
  type RedisMSetArgument,
  type RedisValue,
  type SetOptions,
} from './types';

export const normalizeRedisKey = (key: RedisKey) =>
  typeof key === 'string' ? key : key.toString();

export const normalizeRedisKeys = (keys: RedisKey[]) => keys.map(normalizeRedisKey);

export const normalizeMsetValues = (values: RedisMSetArgument): Record<string, RedisValue> => {
  if (values instanceof Map) {
    return Array.from(values.entries()).reduce<Record<string, RedisValue>>((acc, [key, value]) => {
      acc[normalizeRedisKey(key)] = value;
      return acc;
    }, {});
  }

  return values;
};

/**
 * 从 Redis 读取 JSON 编码的值，并统一将失败情况回退为 null：
 *
 * - redis 客户端为 `null`（未启用 / 未初始化）→ `null`
 * - key 不存在                                   → `null`
 * - JSON 解析失败                                → `null`
 *
 * 将常见的「读取 + 解析 + try/catch」约 8 行写法收成一次调用。
 * 调用方需自行解析出正确的 Redis 客户端（例如通过 `initializeRedisWithPrefix`）；
 * 本辅助函数只做 I/O，不做客户端选择。
 */
export const getJSONFromRedis = async <T>(
  redis: BaseRedisProvider | null,
  key: RedisKey,
): Promise<T | null> => {
  if (!redis) return null;
  const value = await redis.get(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const buildIORedisSetArgs = (options?: SetOptions): Array<string | number> => {
  if (!options) return [];

  const args: Array<string | number> = [];

  if (options.ex !== undefined) args.push('EX', options.ex);
  if (options.px !== undefined) args.push('PX', options.px);
  if (options.exat !== undefined) args.push('EXAT', options.exat);
  if (options.pxat !== undefined) args.push('PXAT', options.pxat);
  if (options.keepTtl) args.push('KEEPTTL');
  if (options.nx) args.push('NX');
  if (options.xx) args.push('XX');
  if (options.get) args.push('GET');

  return args;
};
