/** Chromium net errors that are often transient during desktop task restart. */
export const RETRYABLE_LOAD_ERROR_CODES = new Set([
  -106, // ERR_INTERNET_DISCONNECTED
  -105, // ERR_NAME_NOT_RESOLVED
  -102, // ERR_CONNECTION_REFUSED
  -101, // ERR_CONNECTION_RESET
  -100, // ERR_CONNECTION_CLOSED
  -21, // ERR_NETWORK_CHANGED
  -324, // ERR_EMPTY_RESPONSE
  -7, // ERR_TIMED_OUT
])

export const MAX_RENDERER_RELOAD_ATTEMPTS = 5

export const getRendererReloadDelayMs = (attempt: number) => Math.min(500 * attempt, 2_500)

export const shouldRetryRendererLoad = (errorCode: number, attempt: number) =>
  RETRYABLE_LOAD_ERROR_CODES.has(errorCode) && attempt < MAX_RENDERER_RELOAD_ATTEMPTS
