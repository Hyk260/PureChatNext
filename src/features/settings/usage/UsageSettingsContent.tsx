'use client'

import { Button, Card, DatePicker, Empty, Flex, Input, Progress, Select, Skeleton, Table, type TableProps } from 'antd'
import { Tag, Text } from '@pure/ui'
import { MessageSquareText, RotateCcw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react'

import { SettingHeader } from '@/features/settings/profile/components/SettingHeader'

import { UsageChart } from './UsageChart'
import { type UsageItem, type UsageResponse } from './types'

const { RangePicker } = DatePicker
type PickerValue = Exclude<NonNullable<ComponentProps<typeof RangePicker>['value']>[number], null | undefined>
type DateRange = [PickerValue, PickerValue]
const numberFormat = new Intl.NumberFormat('zh-CN')
const dateTimeFormat = new Intl.DateTimeFormat('zh-CN', {
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  month: '2-digit',
  second: '2-digit',
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
})
const formatDuration = (value: number | null) => (value == null ? '--' : `${(value / 1000).toFixed(2)}s`)

const fillDays = (start: string, end: string, values: UsageResponse['daily']) => {
  const byDay = new Map(values.map((item) => [item.day, item.credits]))
  const days: UsageResponse['daily'] = []
  const cursor = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  while (cursor <= last) {
    const day = cursor.toISOString().slice(0, 10)
    days.push({ credits: byDay.get(day) ?? 0, day })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

export function UsageSettingsContent() {
  const [data, setData] = useState<UsageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState('')
  const [modelQuery, setModelQuery] = useState('')
  const [type, setType] = useState('all')
  const [range, setRange] = useState<DateRange | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sortBy, sortOrder, type })
    if (modelQuery) params.set('model', modelQuery)
    if (range) {
      params.set('startDate', range[0].format('YYYY-MM-DD'))
      params.set('endDate', range[1].format('YYYY-MM-DD'))
    }
    try {
      const response = await fetch(`/api/user/usage?${params}`, { credentials: 'include' })
      const json = (await response.json().catch(() => null)) as (UsageResponse & { error?: string }) | null
      if (!response.ok || !json) throw new Error(json?.error || `HTTP ${response.status}`)
      setData(json)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [modelQuery, page, pageSize, range, sortBy, sortOrder, type])

  useEffect(() => void load(), [load])

  const reset = () => {
    setModel('')
    setModelQuery('')
    setType('all')
    setRange(null)
    setPage(1)
    setPageSize(20)
    setSortBy('createdAt')
    setSortOrder('desc')
  }

  const columns = useMemo<TableProps<UsageItem>['columns']>(
    () => [
      { dataIndex: 'createdAt', key: 'createdAt', render: (value: string) => dateTimeFormat.format(new Date(value)).replaceAll('/', '-'), sorter: true, title: '创建时间', width: 180 },
      { key: 'type', render: () => <MessageSquareText color='var(--ant-color-primary)' size={18} />, title: '类型', width: 80 },
      { key: 'trigger', render: () => '聊天消息', title: '触发方式', width: 110 },
      { dataIndex: 'model', key: 'model', render: (value: string | null) => value || '--', title: '模型', width: 210 },
      {
        key: 'totalTokens',
        render: (_value, record) =>
          record.inputTokens == null && record.outputTokens == null ? '--' : (
            <Flex align='center' gap={6} wrap='wrap'>
              <Tag color='green' size='small'>{numberFormat.format(record.totalTokens)}</Tag>
              <Text type='secondary'>= ↓ {numberFormat.format(record.inputTokens ?? 0)} + ↑ {numberFormat.format(record.outputTokens ?? 0)}</Text>
            </Flex>
          ),
        sorter: true,
        title: 'Token 使用量',
        width: 270,
      },
      { dataIndex: 'credits', key: 'credits', render: (value: number) => numberFormat.format(value), sorter: true, title: '消耗积分', width: 120 },
      { dataIndex: 'durationMs', key: 'durationMs', render: formatDuration, sorter: true, title: '耗时', width: 90 },
    ],
    []
  )

  const daily = data ? fillDays(data.dateRange.startDate, data.dateRange.endDate, data.daily) : []
  const percent = data ? Math.min(100, (data.balance.used / Math.max(1, data.balance.grant)) * 100) : 0

  return (
    <Flex vertical gap={32} style={{ paddingBlock: '24px 64px', paddingInline: 24, width: '100%' }}>
      <SettingHeader title='用量' />
      <Flex vertical gap={12}>
        <Text style={{ fontSize: 20, fontWeight: 600 }}>积分</Text>
        <Card styles={{ body: { padding: 22 } }}>
          {loading && !data ? <Skeleton active /> : error && !data ? (
            <Empty description={error}><Button onClick={() => void load()}>重试</Button></Empty>
          ) : data ? (
            <Flex vertical gap={18}>
              <Text style={{ alignSelf: 'flex-end', fontSize: 18, fontWeight: 600 }}>
                {numberFormat.format(data.balance.used)} / {numberFormat.format(data.balance.grant)} 已使用
              </Text>
              <Progress percent={percent} showInfo={false} />
              <Text type='secondary'>○ 免费积分&nbsp; <Text strong>{numberFormat.format(data.balance.used)}</Text> / {numberFormat.format(data.balance.grant)}</Text>
              <UsageChart data={daily} />
            </Flex>
          ) : null}
        </Card>
      </Flex>

      <Flex vertical gap={12}>
        <Text style={{ fontSize: 20, fontWeight: 600 }}>明细</Text>
        <Card styles={{ body: { padding: 0 } }}>
          <Flex gap={10} style={{ padding: 16 }} wrap='wrap'>
            <Input allowClear onChange={(event) => setModel(event.target.value)} onPressEnter={() => { setModelQuery(model.trim()); setPage(1) }} placeholder='搜索模型' prefix={<Search size={16} />} style={{ flex: '1 1 220px' }} value={model} />
            <Select onChange={(value) => { setType(value); setPage(1) }} options={[{ label: '全部类型', value: 'all' }, { label: '聊天消息', value: 'chat' }]} style={{ flex: '0 1 180px' }} value={type} />
            <RangePicker onChange={(value) => { setRange(value?.[0] && value[1] ? [value[0], value[1]] : null); setPage(1) }} style={{ flex: '1 1 280px' }} value={range} />
            <Button icon={<RotateCcw size={16} />} onClick={reset}>重置</Button>
          </Flex>
          {error && data ? <Flex align='center' gap={12} style={{ padding: 16 }}><Text type='danger'>{error}</Text><Button size='small' onClick={() => void load()}>重试</Button></Flex> : null}
          <Table<UsageItem>
            columns={columns}
            dataSource={data?.items ?? []}
            loading={loading}
            locale={{ emptyText: <Empty description='暂无用量明细' image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            onChange={(pagination, _filters, sorter) => {
              setPage(pagination.current ?? 1)
              setPageSize(pagination.pageSize ?? 20)
              const current = Array.isArray(sorter) ? sorter[0] : sorter
              if (current?.columnKey && current.order) {
                setSortBy(String(current.columnKey))
                setSortOrder(current.order === 'ascend' ? 'asc' : 'desc')
              }
            }}
            pagination={{ current: page, pageSize, showSizeChanger: true, total: data?.total ?? 0 }}
            rowKey='id'
            scroll={{ x: 1060 }}
          />
        </Card>
      </Flex>
    </Flex>
  )
}
