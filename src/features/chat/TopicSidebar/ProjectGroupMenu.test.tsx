import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  confirmModal: vi.fn(),
  deleteProject: vi.fn(),
  listProjects: vi.fn(),
  message: { error: vi.fn(), success: vi.fn() },
  openPath: vi.fn(),
}))

vi.mock('@pure/ui', () => ({
  ActionIcon: ({
    title,
    ...props
  }: React.ComponentProps<'button'> & { icon?: unknown; title?: string }) => (
    <button type='button' title={title} {...props} />
  ),
  DropdownMenu: ({
    children,
    items,
    onOpenChange,
    open,
  }: {
    children?: React.ReactElement<{ onClick?: () => void }>
    items?: Array<Record<string, unknown>>
    onOpenChange?: (open: boolean) => void
    open?: boolean
  }) => (
    <div>
      {React.isValidElement(children)
        ? React.cloneElement(children, { onClick: () => onOpenChange?.(!open) })
        : children}
      {open
        ? items?.map((item) => (
            <button
              key={String(item.key)}
              type='button'
              onClick={() => (item.onClick as (() => void) | undefined)?.()}
            >
              {item.label as React.ReactNode}
            </button>
          ))
        : null}
    </div>
  ),
  Icon: () => <span />,
  confirmModal: mocks.confirmModal,
}))

vi.mock('@/components/AntdStaticMethods', () => ({
  useApp: () => ({ message: mocks.message }),
}))

vi.mock('@/types/desktop', () => ({
  getDesktopApi: () => ({
    deleteProject: mocks.deleteProject,
    listProjects: mocks.listProjects,
    openPath: mocks.openPath,
  }),
}))

import ProjectGroupMenu from './ProjectGroupMenu'

describe('ProjectGroupMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listProjects.mockResolvedValue([{ id: 'p1', name: 'PureChat', rootPath: '/Users/demo/PureChat' }])
    mocks.openPath.mockResolvedValue(undefined)
    mocks.confirmModal.mockImplementation(({ onOk }: { onOk: () => void }) => onOk())
  })

  it('opens the project folder through the desktop shell API', async () => {
    render(<ProjectGroupMenu projectName='PureChat' topicCount={2} onDeleteProject={vi.fn()} />)

    fireEvent.click(screen.getByTitle('项目操作：PureChat'))
    fireEvent.click(screen.getByRole('button', { name: '打开文件夹' }))

    await waitFor(() => {
      expect(mocks.listProjects).toHaveBeenCalled()
      expect(mocks.openPath).toHaveBeenCalledWith('/Users/demo/PureChat')
    })
  })

  it('confirms before deleting the whole project', () => {
    const onDeleteProject = vi.fn()
    render(<ProjectGroupMenu projectName='PureChat' topicCount={3} onDeleteProject={onDeleteProject} />)

    fireEvent.click(screen.getByTitle('项目操作：PureChat'))
    fireEvent.click(screen.getByRole('button', { name: '删除整个项目' }))

    expect(mocks.confirmModal).toHaveBeenCalledWith(
      expect.objectContaining({
        okText: '删除项目',
        title: '删除整个项目？',
      })
    )
    expect(onDeleteProject).toHaveBeenCalledWith('PureChat')
  })
})
