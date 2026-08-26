import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  setThemeMode: vi.fn(),
}))

vi.mock('antd-style', () => ({
  useThemeMode: () => ({ setThemeMode: mocks.setThemeMode, themeMode: 'auto' }),
}))

vi.mock('@pure/ui', () => ({
  Select: ({
    'aria-label': ariaLabel,
    onChange,
    options,
    value,
  }: {
    'aria-label'?: string
    onChange?: (value: string) => void
    options: { label: string; value: string }[]
    value?: string
  }) => (
    <select aria-label={ariaLabel} value={value} onChange={(event) => onChange?.(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

import AppearanceSettingsContent from './AppearanceSettingsContent'

describe('AppearanceSettingsContent', () => {
  beforeEach(() => {
    mocks.setThemeMode.mockClear()
  })

  it('renders all supported theme modes', () => {
    render(<AppearanceSettingsContent />)

    expect(screen.getByText('主题模式')).toBeTruthy()
    expect(screen.getByRole('option', { name: '自动（跟随系统）' })).toBeTruthy()
    expect(screen.getByRole('option', { name: '浅色' })).toBeTruthy()
    expect(screen.getByRole('option', { name: '深色' })).toBeTruthy()
  })

  it('changes the global theme mode', () => {
    render(<AppearanceSettingsContent />)

    fireEvent.change(screen.getByRole('combobox', { name: '主题模式' }), {
      target: { value: 'dark' },
    })

    expect(mocks.setThemeMode).toHaveBeenCalledWith('dark')
  })
})
