import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchAgents: vi.fn(),
  onSelect: vi.fn(),
  setActiveAgent: vi.fn(),
  setSelectedAgentId: vi.fn(),
}))

const agents = [
  {
    avatar: '✨',
    description: '你的默认 AI 助手',
    id: 'agt_inbox',
    systemRole: 'sys',
    title: 'Pure AI',
  },
  {
    avatar: '🌐',
    description: '翻译助手',
    id: 'agt_translate',
    systemRole: 'translate',
    title: '翻译',
  },
]

vi.mock('@pure/ui', () => ({
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode
    onClick?: () => void
  }) => (
    <button type='button' onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuItemContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItemExtra: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  DropdownMenuItemIcon: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  DropdownMenuItemLabel: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  DropdownMenuPopup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuPortal: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DropdownMenuPositioner: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DropdownMenuSubmenuArrow: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  DropdownMenuSubmenuRoot: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DropdownMenuSubmenuTrigger: ({
    children,
    ...props
  }: React.ComponentProps<'button'> & { children?: React.ReactNode }) => (
    <button type='button' {...props}>
      {children}
    </button>
  ),
  Icon: () => <span />,
}))

vi.mock('antd-style', () => ({
  createStaticStyles: () => new Proxy({}, { get: (_, key) => String(key) }),
  cssVar: new Proxy({}, { get: (_, key) => String(key) }),
}))

vi.mock('@/features/home/store/useAgentsStore', () => ({
  useAgentsStore: (selector: (state: unknown) => unknown) =>
    selector({ agents, fetchAgents: mocks.fetchAgents }),
}))

vi.mock('@/features/home/store/useHomeStore', () => ({
  useHomeStore: (selector: (state: unknown) => unknown) =>
    selector({
      selectedAgentId: 'agt_inbox',
      setActiveAgent: mocks.setActiveAgent,
      setSelectedAgentId: mocks.setSelectedAgentId,
    }),
}))

import HomeAgentSelect from './HomeAgentSelect'

describe('HomeAgentSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a submenu of agent names and selects an agent', () => {
    render(<HomeAgentSelect onSelect={mocks.onSelect} />)

    expect(screen.getByRole('button', { name: /选择助理/ })).toBeTruthy()
    expect(screen.queryByText('翻译助手')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '翻译' }))

    expect(mocks.setSelectedAgentId).toHaveBeenCalledWith('agt_translate')
    expect(mocks.setActiveAgent).toHaveBeenCalledWith({
      avatar: '🌐',
      identifier: 'agt_translate',
      systemRole: 'translate',
      title: '翻译',
    })
    expect(mocks.onSelect).toHaveBeenCalled()
  })
})
