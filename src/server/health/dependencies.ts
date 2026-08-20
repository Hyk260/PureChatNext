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

export const HEALTH_CHECK_TIMEOUT_MS = 3_000

const abortError = (message: string) => {
  const error = new Error(message)
  error.name = 'AbortError'
  return error
}

export async function withHealthTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  options?: { parentSignal?: AbortSignal; timeoutMs?: number }
): Promise<T> {
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutMs = options?.timeoutMs ?? HEALTH_CHECK_TIMEOUT_MS
  let removeParentListener: () => void = () => undefined
  const cancellation = options?.parentSignal
    ? new Promise<never>((_, reject) => {
        const cancel = () => {
          reject(options.parentSignal?.reason ?? abortError('health check cancelled'))
          controller.abort(options.parentSignal?.reason)
        }
        if (options.parentSignal?.aborted) cancel()
        else {
          options.parentSignal?.addEventListener('abort', cancel, { once: true })
          removeParentListener = () => options.parentSignal?.removeEventListener('abort', cancel)
        }
      })
    : new Promise<never>(() => undefined)
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort()
      reject(abortError('health check timeout'))
    }, timeoutMs)
  })

  try {
    return await Promise.race([task(controller.signal), deadline, cancellation])
  } finally {
    if (timeout) clearTimeout(timeout)
    removeParentListener()
    controller.abort()
  }
}

async function checkDatabase(parentSignal?: AbortSignal): Promise<HealthDependencyStatus> {
  try {
    await withHealthTimeout(() => serverDB.execute(sql`SELECT 1`), { parentSignal })
    return 'ok'
  } catch {
    return 'unhealthy'
  }
}

async function checkRedis(parentSignal?: AbortSignal): Promise<HealthDependencyStatus> {
  const config = getRedisConfig()
  if (!config.enabled) return 'skipped'

  try {
    const redis = await withHealthTimeout(() => initializeRedis(config), { parentSignal })
    if (!redis) return 'skipped'
    await withHealthTimeout(() => redis.ping(), { parentSignal })
    return 'ok'
  } catch {
    return 'unhealthy'
  }
}

async function checkStorage(parentSignal?: AbortSignal): Promise<HealthDependencyStatus> {
  const configuredValues = [
    fileEnv.S3_ACCESS_KEY_ID,
    fileEnv.S3_SECRET_ACCESS_KEY,
    fileEnv.S3_ENDPOINT,
    fileEnv.S3_BUCKET,
  ]
  if (configuredValues.every((value) => !value)) return 'skipped'
  if (configuredValues.some((value) => !value)) return 'unhealthy'

  try {
    await withHealthTimeout((signal) => new FileS3().checkConnection({ abortSignal: signal }), { parentSignal })
    return 'ok'
  } catch {
    return 'unhealthy'
  }
}

async function checkSearch(parentSignal?: AbortSignal): Promise<HealthDependencyStatus> {
  const baseUrl = toolsEnv.SEARXNG_URL
  if (!baseUrl) return 'skipped'

  try {
    const response = await withHealthTimeout((signal) => fetch(new URL('/healthz', baseUrl), { signal }), {
      parentSignal,
    })
    if (response.ok) return 'ok'

    // Older SearXNG images may not expose /healthz; the root endpoint is still
    // a useful process-level fallback and does not trigger a web search.
    const fallback = await withHealthTimeout((signal) => fetch(new URL('/', baseUrl), { signal }), { parentSignal })
    return fallback.ok ? 'ok' : 'unhealthy'
  } catch {
    return 'unhealthy'
  }
}

export async function checkHealthDependencies(parentSignal?: AbortSignal): Promise<HealthDependencyChecks> {
  const [database, redis, storage, search] = await Promise.all([
    checkDatabase(parentSignal),
    checkRedis(parentSignal),
    checkStorage(parentSignal),
    checkSearch(parentSignal),
  ])

  return { database, redis, storage, search }
}
