import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDesktopApi: vi.fn(),
}))

vi.mock('@/types/desktop', () => ({
  getDesktopApi: () => mocks.getDesktopApi(),
}))

import { SettingsTab, useSettingsCategory } from '../useSettingsCategory'

describe('useSettingsCategory system tools', () => {
  beforeEach(() => {
    mocks.getDesktopApi.mockReset()
  })

  it('includes system tools tab only on desktop', () => {
    mocks.getDesktopApi.mockReturnValue({})
    const { result: desktop } = renderHook(() => useSettingsCategory())
    const systemGroup = desktop.current.find((group) => group.title === '系统')
    expect(systemGroup?.items.some((item) => item.key === SettingsTab.SystemTools)).toBe(true)

    mocks.getDesktopApi.mockReturnValue(undefined)
    const { result: web } = renderHook(() => useSettingsCategory())
    const webSystemGroup = web.current.find((group) => group.title === '系统')
    expect(webSystemGroup?.items.some((item) => item.key === SettingsTab.SystemTools)).toBe(false)
  })
})
