import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
  messageSuccess: vi.fn(),
}))

vi.mock('antd', () => ({
  Divider: () => <hr />,
}))

vi.mock('antd-style', () => ({
  createStaticStyles: () =>
    new Proxy(
      {},
      {
        get: (_target, key) => String(key),
      }
    ),
  cssVar: new Proxy(
    {},
    {
      get: (_target, key) => String(key),
    }
  ),
}))

vi.mock('@pure/ui', () => ({
  ActionIcon: ({ onClick, title }: { onClick?: () => void; title?: string }) => (
    <button type='button' onClick={onClick}>
      {title}
    </button>
  ),
  Block: ({ children }: { children?: React.ReactNode }) => <section>{children}</section>,
  Button: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Flexbox: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Github: () => <span>GitHubIcon</span>,
  PureChatMark: () => <span>Logo</span>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  copyToClipboard: mocks.copyToClipboard,
}))

vi.mock('@/components/AntdStaticMethods', () => ({
  useApp: () => ({ message: { success: mocks.messageSuccess } }),
}))

vi.mock('@/features/settings/profile/components/SettingRow', () => ({
  SettingRow: ({
    action,
    children,
    label,
  }: {
    action?: React.ReactNode
    children?: React.ReactNode
    label?: string
  }) => (
    <div>
      <span>{label}</span>
      {children}
      {action}
    </div>
  ),
}))

vi.mock('@/utils/link', () => ({
  default: ({ children, href }: { children?: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

import { CURRENT_VERSION } from '@/const/version'

import { AboutSettingsContent } from './AboutSettingsContent'

describe('AboutSettingsContent', () => {
  beforeEach(() => {
    mocks.copyToClipboard.mockClear()
    mocks.messageSuccess.mockClear()
  })

  it('shows version, GitHub entry and related links', () => {
    render(<AboutSettingsContent />)

    expect(screen.getAllByText(`v${CURRENT_VERSION}`).length).toBeGreaterThan(0)
    expect(screen.getByText('Hyk260/PureChatNext')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Hyk260\/PureChatNext/ }).getAttribute('href')).toBe(
      'https://github.com/Hyk260/PureChatNext'
    )
    expect(screen.getByRole('link', { name: '打开仓库' }).getAttribute('href')).toBe(
      'https://github.com/Hyk260/PureChatNext'
    )
    expect(screen.getByRole('link', { name: '提交问题' }).getAttribute('href')).toBe(
      'https://github.com/Hyk260/PureChatNext/issues'
    )
    expect(screen.getByRole('link', { name: '参与讨论' }).getAttribute('href')).toBe(
      'https://github.com/Hyk260/PureChatNext/discussions'
    )
    expect(screen.getByRole('link', { name: '查看帮助' }).getAttribute('href')).toBe('/help')
    expect(screen.getByRole('link', { name: '查看政策' }).getAttribute('href')).toBe('/privacy')
    expect(screen.getByRole('link', { name: '查看条款' }).getAttribute('href')).toBe('/terms')
  })

  it('copies the version number', async () => {
    render(<AboutSettingsContent />)

    fireEvent.click(screen.getByRole('button', { name: '复制版本号' }))

    await waitFor(() => {
      expect(mocks.copyToClipboard).toHaveBeenCalledWith(`v${CURRENT_VERSION}`)
      expect(mocks.messageSuccess).toHaveBeenCalledWith('已复制版本号')
    })
  })
})
