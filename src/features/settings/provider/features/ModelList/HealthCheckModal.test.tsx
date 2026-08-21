import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@pure/ui', () => ({
  Alert: ({ message }: { message?: React.ReactNode }) => <div>{message}</div>,
  Flexbox: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Input: ({
    disabled,
    onChange,
    value,
  }: {
    disabled?: boolean
    onChange?: React.ChangeEventHandler<HTMLInputElement>
    value?: string
  }) => <input disabled={disabled} value={value} onChange={onChange} />,
  Modal: ({
    children,
    okButtonProps,
    okText,
    onOk,
  }: {
    children?: React.ReactNode
    okButtonProps?: { disabled?: boolean }
    okText: string
    onOk: () => void
  }) => (
    <div>
      <button disabled={okButtonProps?.disabled} onClick={onOk} type='button'>
        {okText}
      </button>
      {children}
    </div>
  ),
  Switch: ({ checked, onChange }: { checked?: boolean; onChange?: (checked: boolean) => void }) => (
    <button aria-label='concurrency-toggle' aria-pressed={checked} onClick={() => onChange?.(!checked)} type='button' />
  ),
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

import HealthCheckModal from './HealthCheckModal'

describe('HealthCheckModal', () => {
  const onStart = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('defaults to enabled concurrency of two', () => {
    render(
      <HealthCheckModal
        enabledModelCount={5}
        loading={false}
        open
        provider='purechat'
        onCancel={vi.fn()}
        onStart={onStart}
      />
    )

    expect(screen.getByDisplayValue('15')).toBeTruthy()
    expect(screen.getByDisplayValue('2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '开始检查' }))

    expect(onStart).toHaveBeenCalledWith(15_000, 2)
  })

  it('runs serially when concurrency is turned off', () => {
    render(
      <HealthCheckModal
        enabledModelCount={5}
        loading={false}
        open
        provider='purechat'
        onCancel={vi.fn()}
        onStart={onStart}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'concurrency-toggle' }))
    expect((screen.getByDisplayValue('2') as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '开始检查' }))

    expect(onStart).toHaveBeenCalledWith(15_000, 1)
  })

  it('rejects a concurrency value outside 1–4', () => {
    render(
      <HealthCheckModal
        enabledModelCount={5}
        loading={false}
        open
        provider='purechat'
        onCancel={vi.fn()}
        onStart={onStart}
      />
    )

    fireEvent.change(screen.getByDisplayValue('2'), { target: { value: '5' } })

    expect((screen.getByRole('button', { name: '开始检查' }) as HTMLButtonElement).disabled).toBe(true)
    expect(onStart).not.toHaveBeenCalled()
  })
})
