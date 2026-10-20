import { fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MotionProvider } from '@lobehub/ui'
import { motion } from 'motion/react'

import { DEFAULT_PROVIDER_CONFIGS } from './const'
import { useProviderConfigStore } from './store/useProviderConfigStore'

const mocks = vi.hoisted(() => ({
  pathname: '/settings/provider/openai',
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children?: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('@/components/NavItem', () => ({
  default: ({ active, title }: { active?: boolean; title: React.ReactNode }) => (
    <div data-active={String(Boolean(active))}>{title}</div>
  ),
}))

vi.mock('@pure/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@pure/ui')>()),
  AccordionRoot: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AccordionHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AccordionTrigger: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
  AccordionPanel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children?: React.ReactNode }) => <section>{children}</section>,
  Modal: () => null,
  Block: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <section onClick={onClick}>{children}</section>
  ),
  Flex: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Grid: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Icon: () => null,
  ProviderCombine: () => null,
  ProviderIcon: () => null,
  SearchBar: ({
    onInputChange,
    placeholder,
    value,
  }: {
    onInputChange?: (value: string) => void
    placeholder?: string
    value?: string
  }) => <input placeholder={placeholder} value={value} onChange={(event) => onInputChange?.(event.target.value)} />,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/AntdStaticMethods', () => ({
  useApp: () => ({ message: { error: vi.fn(), success: vi.fn() } }),
}))

vi.mock('@/components/Scrollbar', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@lobehub/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@lobehub/ui')>()),
  createStaticStyles: () => new Proxy({}, { get: (_, key) => String(key) }),
  cssVar: new Proxy({}, { get: (_, key) => String(key) }),
  Switch: ({
    checked,
    onChange,
    onClick,
  }: {
    checked?: boolean
    onChange?: (checked: boolean, event: React.MouseEvent<HTMLButtonElement>) => void
    onClick?: (checked: boolean, event: React.MouseEvent<HTMLButtonElement>) => void
  }) => (
    <button
      aria-pressed={checked}
      type='button'
      onClick={(event) => {
        onClick?.(Boolean(checked), event)
        onChange?.(!checked, event)
      }}
    />
  ),
}))

import ProviderAllPage from './ProviderAllPage'
import ProviderSettingsNav from './ProviderSettingsNav'

const renderWithUI = (element: React.ReactNode) => render(<MotionProvider motion={motion}>{element}</MotionProvider>)

describe('provider settings pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pathname = '/settings/provider/openai'
    useProviderConfigStore.setState({
      configs: structuredClone(DEFAULT_PROVIDER_CONFIGS),
    })
  })

  it('groups providers and keeps the card switch from navigating', () => {
    renderWithUI(<ProviderAllPage />)

    expect(screen.getByText('已启用服务商')).toBeTruthy()
    expect(screen.getByText('未启用服务商')).toBeTruthy()

    const openAiCard = screen.getByText('OpenAI').closest('section')
    expect(openAiCard).toBeTruthy()

    fireEvent.click(openAiCard!)
    expect(mocks.push).toHaveBeenCalledWith('/settings/provider/openai')

    mocks.push.mockClear()
    fireEvent.click(within(openAiCard!).getByRole('button'))

    expect(mocks.push).not.toHaveBeenCalled()
    expect(useProviderConfigStore.getState().configs.openai.enabled).toBe(true)
  })

  it('filters provider navigation and marks the current provider active', () => {
    renderWithUI(<ProviderSettingsNav />)

    const openAiLink = screen.getByText('OpenAI').closest('a')
    expect(openAiLink?.querySelector('[data-active="true"]')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('搜索服务商'), { target: { value: 'deep' } })

    expect(screen.getByText('DeepSeek')).toBeTruthy()
    expect(screen.queryByText('OpenAI')).toBeNull()
    expect(screen.getByText('已启用 · 0')).toBeTruthy()
    expect(screen.getByText('未启用 · 1')).toBeTruthy()
  })
})
