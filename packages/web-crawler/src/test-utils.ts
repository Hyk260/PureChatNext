import { vi } from 'vitest';

/**
 * Mock `Response` helper for @pure/web-crawler tests.
 * `json` / `text` / `clone` are `vi.fn()` so suites can stub per case.
 */
export const createMockResponse = (
  body: any,
  opts: { ok: boolean; status?: number; statusText?: string } = { ok: true },
) => {
  const self: any = {
    ok: opts.ok,
    status: opts.status ?? (opts.ok ? 200 : 500),
    statusText: opts.statusText ?? (opts.ok ? 'OK' : 'Internal Server Error'),
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
    clone: vi.fn(),
  };
  self.clone.mockReturnValue({
    ...self,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  });
  return self;
};
