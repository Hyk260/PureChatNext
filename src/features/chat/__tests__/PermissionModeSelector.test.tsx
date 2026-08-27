import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@pure/ui', () => ({
  Icon: () => <span aria-hidden />,
  Modal: ({
    cancelText,
    children,
    okText,
    onCancel,
    onOk,
    open,
    title,
  }: {
    cancelText: string
    children?: React.ReactNode
    okText: string
    onCancel: () => void
    onOk: () => void
    open: boolean
    title?: React.ReactNode
  }) =>
    open ? (
      <div role='dialog'>
        {title}
        {children}
        <button type='button' onClick={onCancel}>
          {cancelText}
        </button>
        <button type='button' onClick={onOk}>
          {okText}
        </button>
      </div>
    ) : null,
  Popover: ({
    children,
    content,
    onOpenChange,
    open,
  }: {
    children: React.ReactElement<{ onClick?: () => void }>
    content?: React.ReactNode
    onOpenChange: (open: boolean) => void
    open: boolean
  }) => (
    <>
      {React.cloneElement(children, { onClick: () => onOpenChange(!open) })}
      {open ? content : null}
    </>
  ),
}))

vi.mock('antd-style', () => ({
  cssVar: new Proxy({}, { get: (_, key) => String(key) }),
}))

import PermissionModeSelector from '../PermissionModeSelector'

describe('PermissionModeSelector', () => {
  it('switches ordinary modes immediately', async () => {
    const onChange = vi.fn()
    render(<PermissionModeSelector value='auto' onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: '权限模式：帮我批准' }))
    fireEvent.click(screen.getByRole('button', { name: /请求批准\s+编辑文件/ }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('ask'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('requires confirmation before enabling full access', async () => {
    const onChange = vi.fn()
    render(<PermissionModeSelector value='auto' onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: '权限模式：帮我批准' }))
    fireEvent.click(screen.getByRole('button', { name: /完全访问权限\s+不受限制/ }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '确认' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('full'))
  })

  it('keeps the current mode when full access is cancelled', () => {
    const onChange = vi.fn()
    render(<PermissionModeSelector value='ask' onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: '权限模式：请求批准' }))
    fireEvent.click(screen.getByRole('button', { name: /完全访问权限\s+不受限制/ }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps the confirmation open when persistence fails', async () => {
    const onChange = vi.fn().mockRejectedValue(new Error('save failed'))
    render(<PermissionModeSelector value='auto' onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: '权限模式：帮我批准' }))
    fireEvent.click(screen.getByRole('button', { name: /完全访问权限\s+不受限制/ }))
    fireEvent.click(screen.getByRole('button', { name: '确认' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('full'))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
