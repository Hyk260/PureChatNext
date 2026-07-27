#!/usr/bin/env bun
/**
 * 向 Redis 写入测试数据
 *
 * 用法:
 *   REDIS_URL=redis://... bun scripts/redis-seed.ts
 *   bun scripts/redis-seed.ts          # 从 .env.local 读取 REDIS_URL
 */
import './lib/load-env'

import { IoRedisRedisProvider } from '../src/libs/redis/redis'

async function main() {
  const url = process.env.REDIS_URL
  if (!url) {
    console.error('❌ 未设置 REDIS_URL')
    process.exit(1)
  }

  const prefix = process.env.REDIS_PREFIX ?? 'purechat'
  const provider = new IoRedisRedisProvider({
    enabled: true,
    prefix,
    tls: process.env.REDIS_TLS === 'true',
    url,
  })

  try {
    await provider.initialize()
    console.log('✅ 已连接 Redis:', url.replace(/:[^:@/]+@/, ':***@'))

    const now = new Date().toISOString()
    const ts = Date.now()

    // 1) 简单 string
    await provider.set('test:hello', `hello-from-seed @ ${now}`, { ex: 600 })
    console.log('  set test:hello')

    // 2) 带过期计数器
    await provider.set('test:counter', String(ts), { ex: 600 })
    const after = await provider.incr('test:counter')
    console.log('  incr test:counter ->', after)

    // 3) hash
    await provider.hset('test:profile', 'name', 'purechat')
    await provider.hset('test:profile', 'seededAt', now)
    await provider.hset('test:profile', 'ts', String(ts))
    console.log('  hset test:profile')

    // 4) pipeline 批量
    const pipe = provider.pipeline()
    pipe.set('test:p1', 'a', { ex: 600 })
    pipe.set('test:p2', 'b', { ex: 600 })
    pipe.set('test:p3', 'c', { ex: 600 })
    pipe.incr('test:pipeline:counter')
    await pipe.exec()
    console.log('  pipeline set test:p1..p3 + incr counter')

    // 回读校验
    const hello = await provider.get('test:hello')
    const profile = await provider.hgetall('test:profile')
    console.log('\n回读校验:')
    console.log('  test:hello =', hello)
    console.log('  test:profile =', profile)
  } finally {
    await provider.disconnect()
    console.log('\n✅ 已断开连接')
  }
}

main().catch((error) => {
  console.error('❌ seed 失败:', error)
  process.exit(1)
})
