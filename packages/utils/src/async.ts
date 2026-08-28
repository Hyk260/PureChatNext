export type AbortableDelayOptions = {
  rejectOnAbort?: boolean
}

const createAbortError = () => Object.assign(new Error('aborted'), { name: 'AbortError' })

export function abortableDelay(
  ms: number,
  signal: AbortSignal,
  { rejectOnAbort = false }: AbortableDelayOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      if (rejectOnAbort) {
        reject(createAbortError())
      } else {
        resolve()
      }
      return
    }

    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)

    const cleanup = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
    }

    const onAbort = () => {
      cleanup()
      if (rejectOnAbort) reject(createAbortError())
      else resolve()
    }

    signal.addEventListener('abort', onAbort, { once: true })
  })
}
