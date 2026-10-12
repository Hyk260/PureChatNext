import { describe, expect, it } from 'vitest'

import type { DesktopUpdateState } from '@/types/desktopUpdater'
import { DEFAULT_UPDATE_PREFERENCES } from '@/types/desktopUpdater'
import { acceptUpdateSnapshot, getUpdateButtonLabel } from './updatePresentation'

const state: DesktopUpdateState = {
  status: 'ready',
  revision: 10,
  preferences: DEFAULT_UPDATE_PREFERENCES,
  currentVersion: '0.2.0',
  developmentCachePath: null,
  progress: 100,
  release: null,
  message: null,
  manual: false,
}

describe('update presentation', () => {
  it('does not overwrite a newer subscription event with a stale IPC response', () => {
    const stale = { ...state, revision: 9, progress: 50 }
    expect(acceptUpdateSnapshot(state, stale)).toBe(state)
    expect(acceptUpdateSnapshot(null, stale)).toBe(stale)
    const next = { ...state, revision: 11 }
    expect(acceptUpdateSnapshot(state, next)).toBe(next)
  })

  it('offers installation only for the ready state, even with 100% progress', () => {
    expect(getUpdateButtonLabel('downloading', 100)).toBe('正在下载 100%')
    expect(getUpdateButtonLabel('downloaded')).toBe('下载完成（开发环境不可安装）')
    expect(getUpdateButtonLabel('ready')).toBe('重启并安装')
  })
})
