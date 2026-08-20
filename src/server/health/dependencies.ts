import { sql } from 'drizzle-orm'

import { serverDB } from '@pure/database/core/db-adaptor'
import { getRedisConfig } from '@/envs/redis'
import { fileEnv } from '@/envs/file'
import { toolsEnv } from '@/envs/tools'
import { FileS3 } from '@/server/modules/S3'
import { initializeRedis } from '@/libs/redis'

export type HealthDependencyStatus = 'ok' | 'skipped' | 'unhealthy'

export type HealthDependencyChecks = {
  database: HealthDependencyStatus
  redis: HealthDependencyStatus
  storage: HealthDependencyStatus
  search: HealthDependencyStatus
}

const CHECK_TIMEOUT_MS = 3_000

async function withTimeout<T>(task: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('health check timeout')), CHECK_TIMEOUT_MS)
  })

  try {
    return await Promise.race([task, deadline])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function checkDatabase(): Promise<HealthDependencyStatus> {
  try {
    await withTimeout(serverDB.execute(sql`SELECT 1`))
    return 'ok'
  } catch {
    return 'unhealthy'
  }
}

async function checkRedis(): Promise<HealthDependencyStatus> {
  const config = getRedisConfig()
  if (!config.enabled) return 'skipped'

  try {
    const redis = await withTimeout(initializeRedis(config))
    if (!redis) return 'skipped'
    await withTimeout(redis.ping())
    return 'ok'
  } catch {
    return 'unhealthy'
  }
}

async function checkStorage(): Promise<HealthDependencyStatus> {
  const configured = Boolean(
    fileEnv.S3_ACCESS_KEY_ID && fileEnv.S3_SECRET_ACCESS_KEY && fileEnv.S3_ENDPOINT && fileEnv.S3_BUCKET
  )
  if (!configured) return 'skipped'

  try {
    await withTimeout(new FileS3().checkConnection())
    return 'ok'
  } catch {
    return 'unhealthy'
  }
}

async function checkSearch(): Promise<HealthDependencyStatus> {
  const baseUrl = toolsEnv.SEARXNG_URL
  if (!baseUrl) return 'skipped'

  try {
    const response = await withTimeout(fetch(new URL('/healthz', baseUrl)))
    if (response.ok) return 'ok'

    // Older SearXNG images may not expose /healthz; the root endpoint is still
    // a useful process-level fallback and does not trigger a web search.
    const fallback = await withTimeout(fetch(new URL('/', baseUrl)))
    return fallback.ok ? 'ok' : 'unhealthy'
  } catch {
    return 'unhealthy'
  }
}

export async function checkHealthDependencies(): Promise<HealthDependencyChecks> {
  const [database, redis, storage, search] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkStorage(),
    checkSearch(),
  ])

  return { database, redis, storage, search }
}
