export const DEFAULT_HEALTH_CHECK_CONCURRENCY = 2
export const MIN_HEALTH_CHECK_CONCURRENCY = 1
export const MAX_HEALTH_CHECK_CONCURRENCY = 4

export const runWithConcurrency = async <T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number,
  signal?: AbortSignal
) => {
  let nextIndex = 0
  const normalizedConcurrency = Number.isFinite(concurrency)
    ? Math.min(MAX_HEALTH_CHECK_CONCURRENCY, Math.max(MIN_HEALTH_CHECK_CONCURRENCY, Math.floor(concurrency)))
    : MIN_HEALTH_CHECK_CONCURRENCY
  const workerCount = Math.min(normalizedConcurrency, items.length)

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length && !signal?.aborted) {
        const item = items[nextIndex++]
        if (item) await worker(item)
      }
    })
  )
}
