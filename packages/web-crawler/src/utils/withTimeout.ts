import { TimeoutError } from './errorType';

/** Default crawl timeout (ms); override with `CRAWLER_TIMEOUT`. */
export const DEFAULT_TIMEOUT = process.env.CRAWLER_TIMEOUT
  ? Number(process.env.CRAWLER_TIMEOUT)
  : 10_000;

/**
 * Run `fn(signal)` with a wall-clock timeout (@pure/web-crawler).
 * Aborts the signal on timeout so underlying `fetch` can cancel.
 */
export const withTimeout = <T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number = DEFAULT_TIMEOUT,
): Promise<T> => {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(`Request timeout after ${ms}ms`));
    }, ms);
  });

  return Promise.race([
    fn(controller.signal).finally(() => clearTimeout(timeoutId)),
    timeoutPromise,
  ]);
};
