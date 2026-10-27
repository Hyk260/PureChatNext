export const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const toTrimmedString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}
