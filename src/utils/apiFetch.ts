/**
 * Browser fetch to same-origin `/api/...`.
 * Dev: Vite proxies `/api` → Next. Prod: same origin as SPA shell.
 * Always sends cookies (`credentials: 'include'`).
 */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  if (/^https?:\/\//i.test(input)) {
    throw new Error(`apiFetch expects a relative /api path, got: ${input}`)
  }

  return fetch(input, {
    ...init,
    credentials: init?.credentials ?? 'include',
  })
}
