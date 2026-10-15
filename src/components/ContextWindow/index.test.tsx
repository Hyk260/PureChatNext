import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ContextWindow } from './index'
import type { ContextWindowPart } from './contextWindowModel'

const parts: ContextWindowPart[] = [
  { id: 'system', label: 'System prompt', locked: true, tokens: 4_200 },
  {
    id: 'files',
    items: [
      { id: 'schema', label: 'schema.prisma', tokens: 9_400 },
      { id: 'billing', label: 'billing.ts', tokens: 21_300 },
    ],
    label: 'Files',
  },
  { compact: true, id: 'chat', label: 'Conversation', tokens: 30_400 },
]

describe('ContextWindow', () => {
  it('renders the model, usage, grouped files, and free capacity', () => {
    render(<ContextWindow limit={200_000} model='claude-sonnet-5-5' parts={parts} />)

    expect(screen.getByRole('heading', { name: 'Context window' })).toBeTruthy()
    expect(screen.getByText('claude-sonnet-5-5')).toBeTruthy()
    expect(screen.getByText('65.3K')).toBeTruthy()
    expect(screen.getByText('135K free')).toBeTruthy()
    expect(screen.getByText('schema.prisma')).toBeTruthy()
    expect(screen.getByText('billing.ts')).toBeTruthy()
  })

  it('highlights a hovered part and dims other occupied cells', () => {
    render(<ContextWindow limit={100_000} model='test-model' parts={parts} />)

    const grid = screen.getByRole('img', { name: '65K of 100K tokens used' })
    const files = screen.getByRole('group', { name: 'Files, 30.7K tokens' })
    fireEvent.mouseEnter(files)

    const fileCell = grid.querySelector('[data-part-id="files"]')
    const systemCell = grid.querySelector('[data-part-id="system"]')
    expect(fileCell).not.toBeNull()
    expect(systemCell).not.toBeNull()
    expect(fileCell?.classList.contains('opacity-100')).toBe(true)
    expect(systemCell?.classList.contains('opacity-25')).toBe(true)
  })

  it('reports file removal, compaction, and new-chat actions', () => {
    const onRemoveItem = vi.fn()
    const onCompact = vi.fn()
    const onNewChat = vi.fn()
    render(
      <ContextWindow
        limit={200_000}
        model='test-model'
        onCompact={onCompact}
        onNewChat={onNewChat}
        onRemoveItem={onRemoveItem}
        parts={parts}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove billing.ts' }))
    fireEvent.click(screen.getByRole('button', { name: 'Compact Conversation' }))
    fireEvent.click(screen.getByRole('button', { name: /New chat/ }))

    expect(onRemoveItem).toHaveBeenCalledWith('files', 'billing')
    expect(onCompact).toHaveBeenCalledWith('chat')
    expect(onNewChat).toHaveBeenCalledOnce()
  })

  it('keeps removal disabled for locked groups and without a callback', () => {
    const lockedParts: ContextWindowPart[] = [
      {
        id: 'locked-files',
        items: [{ id: 'secret', label: 'secret.md', tokens: 100 }],
        label: 'Locked files',
        locked: true,
      },
    ]
    const onRemoveItem = vi.fn()
    const { rerender } = render(
      <ContextWindow limit={1_000} model='test-model' onRemoveItem={onRemoveItem} parts={lockedParts} />
    )

    expect(screen.getByRole('button', { name: 'Remove secret.md' }).hasAttribute('disabled')).toBe(true)

    const unlockedParts: ContextWindowPart[] = [{ id: 'files', items: lockedParts[0].items, label: 'Files' }]
    rerender(<ContextWindow limit={1_000} model='test-model' parts={unlockedParts} />)
    expect(screen.getByRole('button', { name: 'Remove secret.md' }).hasAttribute('disabled')).toBe(true)

    rerender(<ContextWindow limit={1_000} model='test-model' onRemoveItem={onRemoveItem} parts={unlockedParts} />)

    expect(screen.getByRole('button', { name: 'Remove secret.md' }).hasAttribute('disabled')).toBe(false)
  })
})
