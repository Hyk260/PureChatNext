export type DesktopUpdateChannel = 'latest' | 'rc' | 'beta'
export type DesktopUpdateSourceType = 'local' | 'github' | 'custom'

export const LOCAL_UPDATE_URL = 'http://127.0.0.1:5500'
export const GITHUB_UPDATE_SOURCE = { type: 'github', owner: 'Hyk260', repo: 'PureChatNext' } as const

export type DesktopUpdateSource =
  | { type: 'local' | 'custom'; url: string }
  | { type: 'github'; owner: string; repo: string }

export interface DesktopUpdatePreferences {
  autoUpdate: boolean
  testPlan: boolean
  testChannel: 'rc' | 'beta'
  updateSource?: DesktopUpdateSourceType
  customUpdateUrl?: string
}

export const DEFAULT_UPDATE_PREFERENCES: DesktopUpdatePreferences = {
  autoUpdate: true,
  testPlan: false,
  testChannel: 'rc',
}

export interface DesktopUpdateRelease {
  version: string
  notes: string
}

export interface DesktopUpdateInstallationSupport {
  supported: boolean
  signature: 'valid' | 'ad-hoc' | 'unsigned' | 'unknown' | 'not-required' | 'development' | 'unsupported'
  message: string
}

export interface DesktopUpdateLogs {
  text: string
  truncated: boolean
}

export type DesktopUpdateStatus =
  | 'idle'
  | 'checking'
  | 'upToDate'
  | 'downloading'
  | 'downloaded'
  | 'ready'
  | 'installing'
  | 'error'
  | 'unsupported'

export interface DesktopUpdateState {
  revision: number
  status: DesktopUpdateStatus
  currentVersion: string
  developmentCachePath: string | null
  installationSupport: DesktopUpdateInstallationSupport | null
  preferences: DesktopUpdatePreferences
  effectiveSource: DesktopUpdateSource | null
  progress: number
  release: DesktopUpdateRelease | null
  message: string | null
  manual: boolean
}

export function getUpdateChannel(preferences: DesktopUpdatePreferences): DesktopUpdateChannel {
  return preferences.testPlan ? preferences.testChannel : 'latest'
}

function hasBaseUpdatePreferences(value: unknown): value is DesktopUpdatePreferences {
  if (!value || typeof value !== 'object') return false
  const preferences = value as Partial<DesktopUpdatePreferences>
  return (
    typeof preferences.autoUpdate === 'boolean' &&
    typeof preferences.testPlan === 'boolean' &&
    (preferences.testChannel === 'rc' || preferences.testChannel === 'beta')
  )
}

export function isUpdateSourceType(value: unknown): value is DesktopUpdateSourceType {
  return value === 'local' || value === 'github' || value === 'custom'
}

export function normalizeUpdateUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('请输入有效的 HTTP(S) 更新目录地址。')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('更新地址必须使用 http 或 https。')
  }
  if (url.username || url.password || url.hash || url.href.includes('#')) {
    throw new Error('更新地址不能包含凭据或 fragment。')
  }
  return url.toString()
}

export function isUpdatePreferences(value: unknown): value is DesktopUpdatePreferences {
  if (!hasBaseUpdatePreferences(value)) return false
  if (value.updateSource !== undefined && !isUpdateSourceType(value.updateSource)) return false
  if (value.updateSource === 'custom' && !value.customUpdateUrl) return false
  if (value.customUpdateUrl !== undefined) {
    if (typeof value.customUpdateUrl !== 'string') return false
    try {
      normalizeUpdateUrl(value.customUpdateUrl)
    } catch {
      return false
    }
  }
  return true
}

export function normalizeUpdatePreferences(value: unknown): DesktopUpdatePreferences {
  if (!hasBaseUpdatePreferences(value)) return { ...DEFAULT_UPDATE_PREFERENCES }
  const preferences: DesktopUpdatePreferences = {
    autoUpdate: value.autoUpdate, testPlan: value.testPlan, testChannel: value.testChannel,
  }
  if (typeof value.customUpdateUrl === 'string') {
    try {
      preferences.customUpdateUrl = normalizeUpdateUrl(value.customUpdateUrl)
    } catch {
      // Discard an invalid stored address without resetting unrelated switches.
    }
  }
  if (isUpdateSourceType(value.updateSource)) {
    if (value.updateSource !== 'custom' || preferences.customUpdateUrl) preferences.updateSource = value.updateSource
  }
  return preferences
}

export function getUpdateSourceFromUrl(value: string): DesktopUpdateSource {
  const url = normalizeUpdateUrl(value)
  return url === `${LOCAL_UPDATE_URL}/` ? { type: 'local', url: LOCAL_UPDATE_URL } : { type: 'custom', url }
}

export function resolveUpdateSource(
  preferences: DesktopUpdatePreferences,
  fallback: DesktopUpdateSource | null
): DesktopUpdateSource | null {
  if (preferences.updateSource === 'local') return { type: 'local', url: LOCAL_UPDATE_URL }
  if (preferences.updateSource === 'github') return { ...GITHUB_UPDATE_SOURCE }
  if (preferences.updateSource === 'custom') return { type: 'custom', url: normalizeUpdateUrl(preferences.customUpdateUrl || '') }
  return fallback
}
