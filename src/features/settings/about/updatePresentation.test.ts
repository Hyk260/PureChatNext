import { describe, expect, it } from 'vitest'

import type { DesktopUpdateState } from '@/types/desktopUpdater'
import { DEFAULT_UPDATE_PREFERENCES } from '@/types/desktopUpdater'
import {
  acceptUpdateSnapshot,
  canShowInstallConfirmation,
  getUpdateButtonLabel,
  getUpdateCheckFeedback,
  getUpdateProgressPresentation,
} from './updatePresentation'

const state: DesktopUpdateState = {
  status: 'ready',
  revision: 10,
  preferences: DEFAULT_UPDATE_PREFERENCES,
  effectiveSource: null,
  currentVersion: '0.2.0',
  developmentCachePath: null,
  installationSupport: null,
  progress: 100,
  release: null,
  message: null,
  manual: false,
}

describe('update presentation', () => {
  it.each([
    ['upToDate', 'success', '当前已是最新版本。'],
    ['downloading', 'info', '发现新版本，正在下载…'],
    ['ready', 'success', '更新已下载，请查看更新详情。'],
    ['downloaded', 'success', '更新已下载，请查看更新详情。'],
    ['error', 'error', '检查更新失败，请重试。'],
    ['unsupported', 'warning', '当前客户端暂不支持自动更新，请手动下载。'],
  ] as const)('reports the manual check result for %s', (status, type, content) => {
    expect(getUpdateCheckFeedback({ ...state, status })).toEqual({ type, content })
  })

  it('waits for a check result and includes the release version or service error', () => {
    expect(getUpdateCheckFeedback({ ...state, status: 'checking' })).toBeNull()
    expect(getUpdateCheckFeedback({ ...state, status: 'idle' })).toBeNull()
    expect(getUpdateCheckFeedback({ ...state, status: 'downloading', release: { version: '0.3.1', notes: '' } }))
      .toEqual({ type: 'info', content: '发现新版本 v0.3.1，正在下载…' })
    expect(getUpdateCheckFeedback({ ...state, status: 'error', message: '更新源不可用' }))
      .toEqual({ type: 'error', content: '更新源不可用' })
  })

  it('does not overwrite a newer subscription event with a stale IPC response', () => {
    const stale = { ...state, revision: 9, progress: 50 }
    expect(acceptUpdateSnapshot(state, stale)).toBe(state)
    expect(acceptUpdateSnapshot(null, stale)).toBe(stale)
    const next = { ...state, revision: 11 }
    expect(acceptUpdateSnapshot(state, next)).toBe(next)
  })

  it('offers the same confirmation for downloaded and ready, without treating 100% downloading as complete', () => {
    expect(getUpdateButtonLabel('downloading', 100)).toBe('正在下载 100%')
    expect(getUpdateButtonLabel('downloaded')).toBe('重启并安装')
    expect(getUpdateButtonLabel('ready')).toBe('重启并安装')
    expect(canShowInstallConfirmation('downloaded')).toBe(true)
    expect(canShowInstallConfirmation('ready')).toBe(true)
    expect(canShowInstallConfirmation('downloading')).toBe(false)
  })

  it('resets a new download to zero without turning the checking spinner into numeric progress', () => {
    expect(getUpdateProgressPresentation('downloaded', 100)).toEqual({ visible: true, completed: true, percent: 100 })
    expect(getUpdateProgressPresentation('checking', 100)).toEqual({ visible: false, completed: false, percent: 0 })
    expect(getUpdateProgressPresentation('downloading', 0)).toEqual({ visible: true, completed: false, percent: 0 })
    expect(getUpdateProgressPresentation('downloading', 12).percent).toBe(12)
  })

  it.each(['ready', 'downloaded', 'installing'] as const)(
    'keeps a full ring for %s even without a final progress event',
    (status) => {
      expect(getUpdateProgressPresentation(status, 85)).toEqual({ visible: true, completed: true, percent: 100 })
    }
  )

  it('clamps invalid progress and hides the ring outside a download', () => {
    expect(getUpdateProgressPresentation('downloading', Number.NaN).percent).toBe(0)
    expect(getUpdateProgressPresentation('downloading', -1).percent).toBe(0)
    expect(getUpdateProgressPresentation('downloading', 120).percent).toBe(100)
    expect(getUpdateProgressPresentation('idle', 100).visible).toBe(false)
    expect(getUpdateProgressPresentation('error', 85).visible).toBe(false)
  })
})
