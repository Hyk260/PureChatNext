import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  setCurrentViewItemId: vi.fn(),
  setFileParam: vi.fn().mockResolvedValue(undefined),
  setMode: vi.fn(),
}))

vi.mock('@pure/ui', () => ({
  ActionIcon: ({ onClick, title }: { onClick?: () => void; title?: string }) => (
    <button aria-label={title} type='button' onClick={onClick} />
  ),
  Flexbox: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('antd-style', () => ({
  createStaticStyles: () => new Proxy({}, { get: (_, key) => String(key) }),
  cssVar: new Proxy({}, { get: (_, key) => String(key) }),
}))

vi.mock('nuqs', () => ({ useQueryState: () => [null, mocks.setFileParam] }))

vi.mock('@/components/FileIcon', () => ({ default: () => <span data-testid='file-icon' /> }))

vi.mock('@/features/resources/store', () => ({
  useResourceManagerStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      currentViewItemId: 'file-1',
      setCurrentViewItemId: mocks.setCurrentViewItemId,
      setMode: mocks.setMode,
    }),
}))

vi.mock('@/features/resources/store/resourceStore', () => ({
  useResourceStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      resourceList: [
        {
          fileType: 'text/plain',
          id: 'file-1',
          name: 'notes.txt',
          url: '/api/resources/files/file-1/content',
        },
      ],
    }),
}))

vi.mock('./FileContent', () => ({ default: () => <div data-testid='file-content' /> }))

import FileEditor from './index'

describe('FileEditor header', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns to the resource list and clears the file query state', () => {
    render(<FileEditor />)

    expect(screen.getByText('notes.txt')).toBeTruthy()
    expect(screen.getByTestId('file-content')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '返回' }))

    expect(mocks.setFileParam).toHaveBeenCalledWith(null)
    expect(mocks.setCurrentViewItemId).toHaveBeenCalledWith(undefined)
    expect(mocks.setMode).toHaveBeenCalledWith('explorer')
  })
})
