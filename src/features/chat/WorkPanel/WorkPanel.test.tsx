import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  closeWorkPanelTab: vi.fn(),
  openWorkPanelTab: vi.fn(),
  setWorkPanelActiveTab: vi.fn(),
  toggleRightCollapsed: vi.fn(),
  state: {
    workPanelActiveTab: 'params' as const,
    workPanelOpenTabs: ['overview', 'params'] as Array<'overview' | 'params' | 'files'>,
  },
}))

vi.mock('@pure/ui', () => ({
  ActionIcon: ({ title, onClick }: { title?: string; onClick?: () => void }) => (
    <button type='button' onClick={onClick}>
      {title}
    </button>
  ),
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Flex: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Icon: () => <span />,
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
  Tag: ({
    children,
    closeIcon,
    onClick,
    onClose,
  }: {
    children?: React.ReactNode
    closeIcon?: React.ReactNode
    onClick?: () => void
    onClose?: (event: React.MouseEvent<HTMLElement>) => void
  }) => (
    <div>
      <button type='button' onClick={onClick}>
        {children}
      </button>
      <button
        type='button'
        onClick={(event) => onClose?.(event as unknown as React.MouseEvent<HTMLElement>)}
      >
        {closeIcon}
      </button>
    </div>
  ),
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('antd', () => ({
  Slider: () => <div />,
  Switch: () => <div />,
}))

vi.mock('antd-style', () => ({
  createStaticStyles: () => new Proxy({}, { get: (_, key) => String(key) }),
  cssVar: new Proxy({}, { get: (_, key) => String(key) }),
  cx: (...values: Array<string | false | undefined>) => values.filter(Boolean).join(' '),
}))

vi.mock('@/features/chat/store/useChatUiStore', () => ({
  useChatUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      closeWorkPanelTab: mocks.closeWorkPanelTab,
      openWorkPanelTab: mocks.openWorkPanelTab,
      setWorkPanelActiveTab: mocks.setWorkPanelActiveTab,
      toggleRightCollapsed: mocks.toggleRightCollapsed,
      workPanelActiveTab: mocks.state.workPanelActiveTab,
      workPanelOpenTabs: mocks.state.workPanelOpenTabs,
    }),
}))

import WorkPanel from './index'

describe('WorkPanel', () => {
  beforeEach(() => {
    mocks.closeWorkPanelTab.mockReset()
    mocks.openWorkPanelTab.mockReset()
    mocks.setWorkPanelActiveTab.mockReset()
    mocks.toggleRightCollapsed.mockReset()
    mocks.state.workPanelActiveTab = 'params'
    mocks.state.workPanelOpenTabs = ['overview', 'params']
  })

  it('renders open tabs and collapses the work panel', () => {
    render(
      <WorkPanel
        topic={null}
        topicTitle='测试话题'
        value={{ frequency_penalty: null, presence_penalty: null, temperature: 1, top_p: null }}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('概览')).toBeTruthy()
    expect(screen.getByText('参数')).toBeTruthy()
    expect(screen.getByText('创造力')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '折叠工作面板' }))
    expect(mocks.toggleRightCollapsed).toHaveBeenCalled()
  })

  it('closes a title tab from the header', () => {
    render(
      <WorkPanel
        topic={null}
        topicTitle='测试话题'
        value={{ frequency_penalty: null, presence_penalty: null, temperature: null, top_p: null }}
        onChange={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '关闭概览' }))
    expect(mocks.closeWorkPanelTab).toHaveBeenCalledWith('overview')
  })
})
