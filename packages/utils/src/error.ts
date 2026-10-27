/** Preserve empty Error messages and let each caller choose its fallback. */
export const getErrorMessage = (error: unknown, fallback = 'Internal server error'): string =>
  error instanceof Error ? error.message : fallback
