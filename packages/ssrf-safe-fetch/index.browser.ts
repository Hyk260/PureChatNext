/**
 * Browser build of `@pure/ssrf-safe-fetch`.
 * Client-side code uses native `fetch`; SSRF filtering is a server concern.
 */

/** Per-call SSRF overrides (ignored in browser; kept for API parity with Node). */
export interface SSRFOptions {
  allowIPAddressList?: string[];
  allowPrivateIPAddress?: boolean;
  /** Server-only body cap; ignored in browser. */
  maxContentLength?: number;
}

/**
 * Browser `ssrfSafeFetch` — delegates to `fetch`.
 * @_ssrfOptions Ignored; signature matches the Node entry.
 */
export const ssrfSafeFetch = async (
  url: string,
  options?: RequestInit,
  _ssrfOptions?: SSRFOptions,
): Promise<Response> => {
  return fetch(url, options);
};
