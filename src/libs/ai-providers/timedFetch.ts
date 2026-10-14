import { ssrfSafeFetch } from '@pure/ssrf-safe-fetch'

/**
 * Connection-filtered provider transport. Keep timeout and cancellation active
 * through response consumption, including SSE. Never redirect provider credentials.
 */
export const createTimedFetch = (timeoutMs?: number): typeof fetch => {
  return async (input, init) => {
    const inputUrl = input instanceof Request ? input.url : String(input)
    const url = new URL(inputUrl)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
      throw new Error('Invalid provider URL')
    }
    const request = new Request(input, init)
    const signal = timeoutMs
      ? AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)])
      : request.signal

    return ssrfSafeFetch(request.url, {
      body: request.body ? await request.arrayBuffer() : undefined,
      headers: request.headers,
      method: request.method,
      redirect: 'error',
      signal,
    }, { streamResponse: true })
  }
}
