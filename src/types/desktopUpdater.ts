export type DesktopUpdateChannel = 'latest' | 'rc' | 'beta'

export interface DesktopUpdatePreferences {
  autoUpdate: boolean
  testPlan: boolean
  testChannel: 'rc' | 'beta'
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
  preferences: DesktopUpdatePreferences
  progress: number
  release: DesktopUpdateRelease | null
  message: string | null
  manual: boolean
}

export function getUpdateChannel(preferences: DesktopUpdatePreferences): DesktopUpdateChannel {
  return preferences.testPlan ? preferences.testChannel : 'latest'
}

export function isUpdatePreferences(value: unknown): value is DesktopUpdatePreferences {
  if (!value || typeof value !== 'object') return false
  const preferences = value as Partial<DesktopUpdatePreferences>
  return (
    typeof preferences.autoUpdate === 'boolean' &&
    typeof preferences.testPlan === 'boolean' &&
    (preferences.testChannel === 'rc' || preferences.testChannel === 'beta')
  )
}

export function normalizeUpdatePreferences(value: unknown): DesktopUpdatePreferences {
  if (!isUpdatePreferences(value)) return { ...DEFAULT_UPDATE_PREFERENCES }
  return { autoUpdate: value.autoUpdate, testPlan: value.testPlan, testChannel: value.testChannel }
}
