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

  it('includes the manage group only for admins', () => {
    mocks.getDesktopApi.mockReturnValue(undefined)
    const { result: user } = renderHook(() => useSettingsCategory())
    expect(user.current.some((group) => group.title === '管理')).toBe(false)

    const { result: admin } = renderHook(() => useSettingsCategory(true))
    const manage = admin.current.find((group) => group.title === '管理')
    expect(manage?.items.map((item) => item.label)).toEqual(['用户管理', '联网搜索', '邮件服务', '文件读取', 'S3 测试'])
    expect(manage?.items.map((item) => item.href)).toEqual([
      '/settings/users',
      '/settings/web-search',
      '/settings/email-service',
      '/settings/read-file',
      '/settings/s3',
    ])
  })
})
