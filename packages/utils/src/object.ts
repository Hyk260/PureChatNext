export const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type Shape = Record<string, (value: unknown) => value is unknown>
type MatchedShape<S extends Shape> = {
  [K in keyof S]: S[K] extends (value: unknown) => value is infer T ? T : never
} & Record<string, unknown>

/** Check selected fields without coercion; extra fields and object-like arrays are preserved. */
export const matchesShape = <S extends Shape>(shape: S) =>
  (value: unknown): value is MatchedShape<S> =>
    isObjectLike(value) && Object.entries(shape).every(([key, matches]) => matches(value[key]))

export const toTrimmedString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}
