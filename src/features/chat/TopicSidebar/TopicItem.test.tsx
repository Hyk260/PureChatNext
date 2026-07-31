import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { LocalChatTopic } from '@/features/chat/types'

vi.mock('@pure/ui', () => ({
  DropdownMenu: ({ children, items }: { children?: React.ReactNode; items?: Array<Record<string, unknown>> }) => (
    <div>
      {children}
      {items?.map((item, index) => {
        if (item.type === 'divider') return <hr key={`divider-${index}`} />
        const label = String(item.label)
        return (
          <button
            aria-label={label}
            disabled={Boolean(item.disabled)}
            key={String(item.key)}
            type='button'
            onClick={() =>
              (item.onClick as ((info: { domEvent: { stopPropagation: () => void } }) => void) | undefined)?.({
                domEvent: { stopPropagation: vi.fn() },
              })
            }
          >
            {label}
          </button>
        )
      })}
    </div>
  ),
  Flexbox: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Icon: ({ icon, spin }: { icon: { displayName?: string }; spin?: boolean }) => (
    <span data-icon={icon.displayName} data-spin={String(Boolean(spin))} />
  ),
  Modal: () => null,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  confirmModal: vi.fn(),
}))

vi.mock('antd-style', () => ({
  createStaticStyles: () => new Proxy({}, { get: (_, key) => String(key) }),
  cssVar: new Proxy({}, { get: (_, key) => String(key) }),
  cx: (...values: unknown[]) => values.filter(Boolean).join(' '),
}))

import TopicItem from './TopicItem'

const topic: LocalChatTopic = {
  agentId: 'agent-1',
  createdAt: 1,
  favorite: false,
  id: 'topic-1',
  projectName: null,
  title: '测试对话',
  updatedAt: 2,
}

const renderItem = (overrides?: Partial<React.ComponentProps<typeof TopicItem>>) => {
  const props: React.ComponentProps<typeof TopicItem> = {
    active: false,
    autoRenameDisabled: false,
    autoRenaming: false,
    projectNames: [],
    topic,
    onAutoRename: vi.fn(),
    onDelete: vi.fn(),
    onFavorite: vi.fn(),
    onProjectChange: vi.fn(),
    onRename: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  }

  return { props, ...render(<TopicItem {...props} />) }
}

describe('TopicItem smart rename state', () => {
  it('shows a hash icon before the topic title while idle', () => {
    const { container } = renderItem()

    expect(container.querySelector('[data-icon="Hash"]')).toBeTruthy()
    expect(container.querySelector('[data-icon="LoaderCircle"]')).toBeNull()
  })

  it('replaces the hash with a spinning loader for the renaming topic', () => {
    const { container } = renderItem({ autoRenameDisabled: true, autoRenaming: true })

    const loader = container.querySelector('[data-icon="LoaderCircle"]')
    expect(loader?.getAttribute('data-spin')).toBe('true')
    expect(container.querySelector('[data-icon="Hash"]')).toBeNull()
    expect((screen.getByRole('button', { name: '正在智能重命名…' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('starts smart rename with the current topic id', () => {
    const { props } = renderItem()

    fireEvent.click(screen.getByRole('button', { name: '智能重命名' }))
    expect(props.onAutoRename).toHaveBeenCalledWith(topic.id)
  })
})
