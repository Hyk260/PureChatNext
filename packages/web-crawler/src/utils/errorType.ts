/** Typed crawl/fetch errors for @pure/web-crawler. */

export class PageNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageNotFoundError';
  }
}

export class NetworkConnectionError extends Error {
  constructor() {
    super('Network connection error');
    this.name = 'NetworkConnectionError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** True when undici/Node reports a network-level `fetch failed` TypeError. */
export const isFetchNetworkError = (error: unknown): boolean =>
  error instanceof TypeError && (error as Error).message === 'fetch failed';

/**
 * Map a raw fetch error to a typed error for callers to rethrow.
 * Network failures → `NetworkConnectionError`; `TimeoutError` passes through.
 */
export const toFetchError = (error: unknown): Error => {
  if (isFetchNetworkError(error)) {
    return new NetworkConnectionError();
  }

  if (error instanceof TimeoutError) {
    return error;
  }

  return error as Error;
};
