import { fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_PROVIDER_CONFIGS } from './const'
import { useProviderConfigStore } from './store/useProviderConfigStore'

const mocks = vi.hoisted(() => ({
  pathname: '/settings/provider/openai',
  push: vi.fn(),
}))

vi.mock('@/utils/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('@/utils/link', () => ({
  default: ({ children, href }: { children?: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('@/components/NavItem', () => ({
  default: ({ active, title }: { active?: boolean; title: React.ReactNode }) => (
    <div data-active={String(Boolean(active))}>{title}</div>
  ),
}))

vi.mock('@pure/ui', () => ({
  Accordion: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) => (
    <section>
      {title}
      {children}
    </section>
  ),
  Block: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <section onClick={onClick}>{children}</section>
  ),
  Flex: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Grid: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Icon: () => null,
  ProviderCombine: () => null,
  ProviderIcon: () => null,
  ScrollShadow: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SearchBar: ({
    onInputChange,
    placeholder,
    value,
  }: {
    onInputChange?: (value: string) => void
    placeholder?: string
    value?: string
  }) => <input placeholder={placeholder} value={value} onChange={(event) => onInputChange?.(event.target.value)} />,
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
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('antd-style', () => ({
  createStaticStyles: () => new Proxy({}, { get: (_, key) => String(key) }),
  cssVar: new Proxy({}, { get: (_, key) => String(key) }),
}))

import ProviderAllPage from './ProviderAllPage'
import ProviderSettingsNav from './ProviderSettingsNav'

describe('provider settings pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pathname = '/settings/provider/openai'
    useProviderConfigStore.setState({
      configs: structuredClone(DEFAULT_PROVIDER_CONFIGS),
    })
  })

  it('groups providers and keeps the card switch from navigating', () => {
    render(<ProviderAllPage />)

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
    render(<ProviderSettingsNav />)

    const openAiLink = screen.getByText('OpenAI').closest('a')
    expect(openAiLink?.querySelector('[data-active="true"]')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('搜索服务商'), { target: { value: 'deep' } })

    expect(screen.getByText('DeepSeek')).toBeTruthy()
    expect(screen.queryByText('OpenAI')).toBeNull()
    expect(screen.getByText('已启用 · 0')).toBeTruthy()
    expect(screen.getByText('未启用 · 1')).toBeTruthy()
  })
})
