import { track } from '@vercel/analytics'
import { localStg } from '@pure/utils/storage'

type EventProperties = Record<string, boolean | null | number | string>

type Attribution = {
  campaign: string
  capturedAt: string
  landingPath: string
  medium: string
  referrer: string
  source: string
}

const isAttribution = (value: unknown): value is Attribution => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const attribution = value as Record<string, unknown>
  return (
    typeof attribution.campaign === 'string' &&
    typeof attribution.capturedAt === 'string' &&
    typeof attribution.landingPath === 'string' &&
    typeof attribution.medium === 'string' &&
    typeof attribution.referrer === 'string' &&
    typeof attribution.source === 'string'
  )
}

const FIRST_ATTRIBUTION_KEY = 'purechat:acquisition:first:v1'
const LAST_ATTRIBUTION_KEY = 'purechat:acquisition:last:v1'
const CONVERSION_PREFIX = 'purechat:conversion:v1:'

const readAttribution = (key: string): Attribution | undefined => {
  const value = localStg.getJson(key)
  return isAttribution(value) ? value : undefined
}

const writeStorage = (key: string, value: unknown) => {
  localStg.setJson(key, value)
}

const inferSource = (url: URL, referrer: string) => {
  const explicitSource = url.searchParams.get('utm_source')?.trim()
  if (explicitSource) return explicitSource

  if (!referrer) return 'direct'
  try {
    return new URL(referrer).hostname || 'referral'
  } catch {
    return 'referral'
  }
}

const sanitizeReferrer = (referrer: string) => {
  if (!referrer) return ''
  try {
    return new URL(referrer).origin
  } catch {
    return ''
  }
}

export const captureAcquisitionAttribution = (location: Location, referrer: string) => {
  const url = new URL(location.href)
  const attribution: Attribution = {
    campaign: url.searchParams.get('utm_campaign')?.trim() || '(none)',
    capturedAt: new Date().toISOString(),
    landingPath: url.pathname.slice(0, 500),
    medium: url.searchParams.get('utm_medium')?.trim() || (referrer ? 'referral' : '(none)'),
    referrer: sanitizeReferrer(referrer),
    source: inferSource(url, referrer),
  }

  if (!readAttribution(FIRST_ATTRIBUTION_KEY)) writeStorage(FIRST_ATTRIBUTION_KEY, attribution)
  writeStorage(LAST_ATTRIBUTION_KEY, attribution)
}

const attributionProperties = (): EventProperties => {
  const first = readAttribution(FIRST_ATTRIBUTION_KEY)
  const last = readAttribution(LAST_ATTRIBUTION_KEY)

  return {
    first_source: first?.source ?? 'unknown',
    landing_path: first?.landingPath ?? 'unknown',
    last_campaign: last?.campaign ?? '(none)',
    last_medium: last?.medium ?? '(none)',
    last_source: last?.source ?? 'unknown',
  }
}

export const trackAcquisitionEvent = (name: string, properties: EventProperties = {}) => {
  track(name, { ...attributionProperties(), ...properties })
}

export const markFirstConversion = (name: string) => {
  const key = `${CONVERSION_PREFIX}${name}`
  if (localStg.getString(key)) return false
  return localStg.setString(key, new Date().toISOString())
}
