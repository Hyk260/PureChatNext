import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
  getDesktopApi: vi.fn(),
  getSystemTools: vi.fn(),
  messageSuccess: vi.fn(),
}))

vi.mock('antd', () => ({
  Divider: () => <hr />,
}))

vi.mock('@pure/ui', () => ({
  ActionIcon: ({ onClick, title }: { onClick?: () => void; title?: string }) => (
    <button type='button' onClick={onClick}>
      {title}
    </button>
  ),
  Block: ({ children }: { children?: React.ReactNode }) => <section>{children}</section>,
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button type='button' onClick={onClick}>
      {children}
    </button>
  ),
  Flex: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Skeleton: () => <div>loading</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  copyToClipboard: mocks.copyToClipboard,
}))

vi.mock('@/components/AntdStaticMethods', () => ({
  useApp: () => ({ message: { success: mocks.messageSuccess } }),
}))

vi.mock('@/types/desktop', () => ({
  getDesktopApi: () => mocks.getDesktopApi(),
}))

import { SystemToolsSettingsContent } from './SystemToolsSettingsContent'

const sampleTools = {
  builtin: [
    { description: 'Electron 框架版本', id: 'electron', name: 'Electron', version: '41.3.0' },
    { description: 'Chromium 浏览器引擎版本', id: 'chromium', name: 'Chromium', version: '150.0.0' },
    { description: '内嵌 Node.js 版本', id: 'node', name: 'Node.js', version: '24.18.0' },
  ],
  runtime: [
    {
      available: true,
      description: 'Node.js - 执行 JavaScript/TypeScript 的运行时',
      id: 'node',
      name: 'node',
      path: '/usr/local/bin/node',
      version: 'v22.13.1',
    },
    {
      available: false,
      description: 'Bun - 快速的 JavaScript 运行时和包管理器',
      id: 'bun',
      name: 'bun',
      path: null,
      version: null,
    },
  ],
}

describe('SystemToolsSettingsContent', () => {
  beforeEach(() => {
    mocks.copyToClipboard.mockClear()
    mocks.getSystemTools.mockReset()
    mocks.messageSuccess.mockClear()
    mocks.getDesktopApi.mockReset()
  })

  it('shows desktop-only notice when desktop API is unavailable', () => {
    mocks.getDesktopApi.mockReturnValue(undefined)
    render(<SystemToolsSettingsContent />)
    expect(screen.getByText('系统工具仅在桌面端可用。')).toBeTruthy()
  })

  it('renders runtime and builtin sections from desktop API', async () => {
    mocks.getSystemTools.mockResolvedValue(sampleTools)
    mocks.getDesktopApi.mockReturnValue({ getSystemTools: mocks.getSystemTools })

    render(<SystemToolsSettingsContent />)

    await waitFor(() => {
      expect(screen.getByText('运行环境')).toBeTruthy()
    })
    expect(screen.getByText('内建应用工具')).toBeTruthy()
    expect(screen.getByText('v22.13.1')).toBeTruthy()
    expect(screen.getByText('可用')).toBeTruthy()
    expect(screen.getByText('不可用')).toBeTruthy()
    expect(screen.getByText('Electron')).toBeTruthy()
    expect(screen.getByText('41.3.0')).toBeTruthy()
  })

  it('copies runtime path', async () => {
    mocks.getSystemTools.mockResolvedValue(sampleTools)
    mocks.getDesktopApi.mockReturnValue({ getSystemTools: mocks.getSystemTools })

    render(<SystemToolsSettingsContent />)
    await waitFor(() => expect(screen.getByRole('button', { name: '复制路径' })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: '复制路径' }))
    await waitFor(() => {
      expect(mocks.copyToClipboard).toHaveBeenCalledWith('/usr/local/bin/node')
      expect(mocks.messageSuccess).toHaveBeenCalledWith('已复制路径')
    })
  })

  it('shows retry action when loading fails', async () => {
    mocks.getSystemTools.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce(sampleTools)
    mocks.getDesktopApi.mockReturnValue({ getSystemTools: mocks.getSystemTools })

    render(<SystemToolsSettingsContent />)
    await waitFor(() => expect(screen.getByText('无法加载系统工具信息')).toBeTruthy())

    fireEvent.click(screen.getByText('重试'))
    await waitFor(() => expect(screen.getByText('运行环境')).toBeTruthy())
    expect(mocks.getSystemTools).toHaveBeenCalledTimes(2)
  })
})
