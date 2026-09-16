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

/**
 * Build a RequestInit that sends a JSON body with `Content-Type: application/json`.
 * `method` 仍由调用方在 `init` 中显式传入，保持 POST/PATCH/PUT 可读。
 */
export function jsonInit(body: unknown, init?: RequestInit): RequestInit {
  return {
    ...init,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  }
}
