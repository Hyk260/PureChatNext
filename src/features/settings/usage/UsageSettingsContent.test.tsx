import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

vi.mock('antd', () => ({
  DatePicker: {
    RangePicker: ({ onChange }: { onChange?: (value: unknown) => void }) => (
      <button type='button' onClick={() => onChange?.(null)}>
        日期范围
      </button>
    ),
  },
  Pagination: ({ onChange, pageSize }: { onChange?: (page: number, pageSize: number) => void; pageSize: number }) => (
    <button type='button' onClick={() => onChange?.(2, pageSize)}>
      下一页
    </button>
  ),
  Progress: ({ percent }: { percent?: number }) => <span data-testid='progress'>{percent}</span>,
  Table: ({ onChange }: { onChange?: (pagination: unknown, filters: unknown, sorter: unknown) => void }) => (
    <button type='button' onClick={() => onChange?.({}, {}, { columnKey: 'credits', order: 'ascend' })}>
      积分排序
    </button>
  ),
}))

vi.mock('@pure/ui', () => ({
  Flex: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Block: ({ children }: { children?: React.ReactNode }) => <section>{children}</section>,
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  Empty: ({ action, description }: { action?: React.ReactNode; description?: React.ReactNode }) => (
    <div>
      {description}
      {action}
    </div>
  ),
  Grid: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ModelIcon: () => null,
  SearchBar: ({
    onInputChange,
    onSearch,
    placeholder,
    value,
  }: {
    onInputChange?: (value: string) => void
    onSearch?: (value: string) => void
    placeholder?: string
    value?: string
  }) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={(event) => onInputChange?.(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSearch?.(event.currentTarget.value)
      }}
    />
  ),
  Select: ({
    onChange,
    options,
    value,
  }: {
    onChange?: (value: string) => void
    options: { label: string; value: string }[]
    value?: string
  }) => (
    <select value={value} onChange={(event) => onChange?.(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Skeleton: () => <div>加载中</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('antd-style', () => ({
  createStaticStyles: () => new Proxy({}, { get: (_, key) => String(key) }),
  cssVar: new Proxy({}, { get: (_, key) => String(key) }),
}))

import { UsageSettingsContent } from './UsageSettingsContent'

const usageResponse = {
  balance: {
    grant: 500_000,
    period: '2026-07',
    remaining: 486_889,
    resetIn: { days: 8, hours: 3 },
    used: 13_111,
  },
  items: [],
  models: [],
  page: 1,
  pageSize: 10,
  storage: { limitBytes: 15 * 1024 * 1024, usedBytes: 1.6 * 1024 * 1024 },
  total: 24,
  totalCredits: 13_111,
}

describe('UsageSettingsContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockImplementation(async () => Response.json(usageResponse))
  })

  it('renders only the requested overview metrics', async () => {
    render(<UsageSettingsContent />)

    await waitFor(() => expect(screen.getByText('积分')).toBeTruthy())
    expect(screen.getByText('文件使用量')).toBeTruthy()
    expect(screen.getByText(/13,111 \/ 500,000/)).toBeTruthy()
    expect(screen.getByText('当前方案：免费版')).toBeTruthy()
    expect(screen.getByText('8 天后重置')).toBeTruthy()
    expect(screen.queryByText('升级')).toBeNull()
    expect(screen.queryByText(/返利积分|向量存储|每日积分消耗趋势/)).toBeNull()
  })

  it('updates search, filtering, sorting, paging, and reset query parameters', async () => {
    render(<UsageSettingsContent />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const search = screen.getByPlaceholderText('搜索模型')
    fireEvent.change(search, { target: { value: 'sonnet' } })
    fireEvent.keyDown(search, { key: 'Enter' })
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('model=sonnet'))

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'chat' } })
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('type=chat'))

    fireEvent.click(screen.getByText('积分排序'))
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('sortBy=credits'))

    fireEvent.click(screen.getByText('下一页'))
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('page=2'))

    fireEvent.click(screen.getByText('重置'))
    await waitFor(() => {
      const url = String(fetchMock.mock.calls.at(-1)?.[0])
      expect(url).toContain('pageSize=10')
      expect(url).toContain('sortBy=createdAt')
      expect(url).toContain('type=all')
      expect(url).not.toContain('model=')
    })
  })
})
