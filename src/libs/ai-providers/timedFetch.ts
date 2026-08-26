import { Agent, fetch as undiciFetch } from 'undici'

/**
 * Fetch that honors `timeoutMs` for connect / headers / body.
 * Global `fetch` uses undici's 10s connectTimeout, which aborts before the check's 15–60s budget.
 */
export const createTimedFetch = (timeoutMs: number) => {
  const dispatcher = new Agent({
    bodyTimeout: timeoutMs,
    connectTimeout: timeoutMs,
    headersTimeout: timeoutMs,
  })

  return (input: RequestInfo | URL, init?: RequestInit) =>
    undiciFetch(input as Parameters<typeof undiciFetch>[0], {
      ...(init as object),
      dispatcher,
    } as Parameters<typeof undiciFetch>[1]) as unknown as ReturnType<typeof fetch>
}
