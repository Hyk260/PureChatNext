/**
 * Shared env coercion helpers for `@pure/env` modules.
 * Boolean truthy values: `'1'` / `'true'` (case-insensitive).
 */

import { z } from 'zod'

export const parseEnvInt = (value?: string, fallback?: number): number | undefined => {
  if (value === undefined || value === '') {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) ? parsed : fallback
}

export const parseEnvBoolean = (value?: string, fallback = false): boolean => {
  if (value === undefined || value === '') {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === '1' || normalized === 'true') return true
  if (normalized === '0' || normalized === 'false') return false
  return fallback
}

/** Like `parseEnvBoolean`, but treats missing values as `true` unless explicitly `'0'` / `'false'`. */
export const parseEnvBooleanDefaultTrue = (value?: string): boolean => {
  if (value === undefined || value === '') return true
  const normalized = value.trim().toLowerCase()
  return normalized !== '0' && normalized !== 'false'
}

/** Optional int env with coerce; empty / null → undefined. */
export const optionalNumberEnv = (min: number, max: number) => {
  return z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.coerce.number().int().max(max).min(min).optional()
  )
}
