'use client'

import { DatePicker, Pagination, Progress, Table } from 'antd'
import type { TableProps } from 'antd'
import { Block, Button, Empty, Grid, ModelIcon, SearchBar, Select, Skeleton, Tag, Text, Flexbox } from '@pure/ui'
import { SHANGHAI_TIMEZONE } from '@pure/const'
import { formatSize } from '@pure/utils/client'
import { createStaticStyles, cssVar } from 'antd-style'
import { MessageSquareText, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ComponentProps } from 'react'

import type { UsageItem, UsageResponse } from './types'

const { RangePicker } = DatePicker
type PickerValue = Exclude<NonNullable<ComponentProps<typeof RangePicker>['value']>[number], null | undefined>
type DateRange = [PickerValue, PickerValue]

const numberFormat = new Intl.NumberFormat('zh-CN')
const dateTimeFormat = new Intl.DateTimeFormat('zh-CN', {
  day: 'numeric',
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  month: 'numeric',
  second: '2-digit',
  timeZone: SHANGHAI_TIMEZONE,
})

const formatDuration = (value: number | null) => (value == null ? '--' : `${(value / 1000).toFixed(2)}s`)
const formatDateTime = (value: string) => dateTimeFormat.format(new Date(value)).replace('日', '')
const getPercentage = (used: number, limit: number) => Math.round((used / Math.max(1, limit)) * 100)

const styles = createStaticStyles(({ css }) => ({
  details: css`
    overflow: hidden;
  `,
  error: css`
    padding: 12px 16px;
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};
  `,
  metric: css`
    min-width: 0;
    padding: 16px;

    & + & {
      border-inline-start: 1px solid ${cssVar.colorBorderSecondary};
    }

    @media (width <= 640px) {
      & + & {
        border-block-start: 1px solid ${cssVar.colorBorderSecondary};
        border-inline-start: 0;
      }
    }
  `,
  metricGrid: css`
    width: 100%;
  `,
  metricLabel: css`
    color: ${cssVar.colorTextSecondary};
    font-size: 15px;
  `,
  metricValue: css`
    font-size: 16px;
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  `,
  model: css`
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  `,
  page: css`
    width: 100%;
    padding: 24px 24px 64px;
  `,
  pagination: css`
    padding: 12px 16px;
    border-top: 1px solid ${cssVar.colorBorderSecondary};

    @media (width <= 640px) {
      align-items: flex-start !important;
      flex-direction: column;

      .ant-pagination-options {
        display: none;
      }
    }
  `,
  section: css`
    padding: 16px;
  `,
  sectionTitle: css`
    font-size: 18px;
    font-weight: 600;
  `,
  table: css`
    .ant-table-thead > tr > th {
      padding-block: 11px;
      font-weight: 600;
      background: ${cssVar.colorBgContainer};
    }

    .ant-table-tbody > tr > td {
      padding-block: 9px;
    }
  `,
  title: css`
    text-align: center;
    font-size: 20px;
    font-weight: 600;
  `,
  toolbar: css`
    padding: 12px 16px;
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};
  `,
}))

type UsageMetricProps = {
  label: string
  limit: number
  used: number
  value: string
}

const UsageMetric = ({ label, limit, used, value }: UsageMetricProps) => {
  const percentage = getPercentage(used, limit)

  return (
    <Flexbox horizontal align='center' className={styles.metric} justify='space-between'>
      <Flexbox gap={5}>
        <Text className={styles.metricLabel}>{label}</Text>
        <Text className={styles.metricValue}>
          {value} ({percentage}%)
        </Text>
      </Flexbox>
      <Progress
        percent={Math.min(100, percentage)}
        showInfo={false}
        size={42}
        strokeColor={cssVar.colorSuccess}
        strokeWidth={8}
        trailColor={cssVar.colorFillSecondary}
        type='circle'
      />
    </Flexbox>
  )
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
  const [pageSize, setPageSize] = useState(10)
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
    setPageSize(10)
    setSortBy('createdAt')
    setSortOrder('desc')
  }

  const activeSortOrder = useCallback(
    (key: string) => (sortBy === key ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null),
    [sortBy, sortOrder]
  )

  const columns = useMemo<TableProps<UsageItem>['columns']>(
    () => [
      {
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: formatDateTime,
        sortOrder: activeSortOrder('createdAt'),
        sorter: true,
        title: '时间',
        width: 160,
      },
      {
        key: 'type',
        render: () => <MessageSquareText color={cssVar.colorPrimary} size={18} />,
        title: '类型',
        width: 72,
      },
      { key: 'trigger', render: () => '聊天消息', title: '触发方式', width: 105 },
      {
        dataIndex: 'model',
        key: 'model',
        render: (value: string | null) =>
          value ? (
            <span className={styles.model}>
              <ModelIcon model={value} size={20} />
              <span>{value}</span>
            </span>
          ) : (
            '--'
          ),
        title: '模型',
        width: 210,
      },
      {
        key: 'totalTokens',
        render: (_value, record) =>
          record.inputTokens == null && record.outputTokens == null ? (
            '--'
          ) : (
            <Flexbox horizontal align='center' gap={6} wrap='wrap'>
              <Tag color={record.totalTokens >= 50_000 ? 'orange' : 'green'} size='small'>
                {numberFormat.format(record.totalTokens)}
              </Tag>
              <Text type='secondary'>
                = ↓ {numberFormat.format(record.inputTokens ?? 0)} + ↑ {numberFormat.format(record.outputTokens ?? 0)}
              </Text>
            </Flexbox>
          ),
        sortOrder: activeSortOrder('totalTokens'),
        sorter: true,
        title: 'Token 使用量',
        width: 270,
      },
      {
        dataIndex: 'credits',
        key: 'credits',
        render: (value: number) => numberFormat.format(value),
        sortOrder: activeSortOrder('credits'),
        sorter: true,
        title: '消耗积分',
        width: 115,
      },
      {
        dataIndex: 'durationMs',
        key: 'durationMs',
        render: formatDuration,
        sortOrder: activeSortOrder('durationMs'),
        sorter: true,
        title: '耗时',
        width: 85,
      },
    ],
    [activeSortOrder]
  )

  const total = data?.total ?? 0
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  return (
    <Flexbox className={styles.page} gap={40}>
      <Block className={styles.section} gap={16} variant='filled'>
        <Text className={styles.sectionTitle}>总览</Text>
        {loading && !data ? (
          <Block padding={16} variant='outlined'>
            <Skeleton active paragraph={{ rows: 2 }} />
          </Block>
        ) : error && !data ? (
          <Block variant='outlined'>
            <Empty action={<Button onClick={() => void load()}>重试</Button>} description={error} />
          </Block>
        ) : data ? (
          <Block padding={0} variant='outlined'>
            <Grid className={styles.metricGrid} gap={0} maxItemWidth={300} rows={2}>
              <UsageMetric
                label='积分'
                limit={data.balance.grant}
                used={data.balance.used}
                value={`${numberFormat.format(data.balance.used)} / ${numberFormat.format(data.balance.grant)}`}
              />
              <UsageMetric
                label='文件使用量'
                limit={data.storage.limitBytes}
                used={data.storage.usedBytes}
                value={`${formatSize(data.storage.usedBytes)} / ${formatSize(data.storage.limitBytes)}`}
              />
            </Grid>
          </Block>
        ) : null}
      </Block>

      <Block className={styles.section} gap={16} variant='filled'>
        <Text className={styles.sectionTitle}>明细</Text>
        <Block className={styles.details} padding={0} variant='outlined'>
          <Flexbox horizontal className={styles.toolbar} gap={10} wrap='wrap'>
            <SearchBar
              loading={loading}
              placeholder='搜索模型'
              style={{ flex: '1 1 260px' }}
              value={model}
              onInputChange={(value) => {
                setModel(value)
                if (!value) {
                  setModelQuery('')
                  setPage(1)
                }
              }}
              onSearch={(value) => {
                setModelQuery(value.trim())
                setPage(1)
              }}
            />
            <Select
              options={[
                { label: '全部类型', value: 'all' },
                { label: '聊天消息', value: 'chat' },
              ]}
              style={{ flex: '0 1 180px' }}
              value={type}
              onChange={(value) => {
                setType(String(value))
                setPage(1)
              }}
            />
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              style={{ flex: '1 1 280px' }}
              value={range}
              onChange={(value) => {
                setRange(value?.[0] && value[1] ? [value[0], value[1]] : null)
                setPage(1)
              }}
            />
            <Button icon={RotateCcw} onClick={reset}>
              重置
            </Button>
          </Flexbox>

          {error && data ? (
            <Flexbox horizontal align='center' className={styles.error} gap={12}>
              <Text type='danger'>{error}</Text>
              <Button size='small' onClick={() => void load()}>
                重试
              </Button>
            </Flexbox>
          ) : null}

          <Table<UsageItem>
            className={styles.table}
            columns={columns}
            dataSource={data?.items ?? []}
            loading={loading}
            locale={{ emptyText: <Empty description='暂无用量明细' /> }}
            pagination={false}
            rowKey='id'
            scroll={{ x: 1017 }}
            onChange={(_pagination, _filters, sorter) => {
              const current = Array.isArray(sorter) ? sorter[0] : sorter
              if (current?.columnKey && current.order) {
                setSortBy(String(current.columnKey))
                setSortOrder(current.order === 'ascend' ? 'asc' : 'desc')
                setPage(1)
              }
            }}
          />

          <Flexbox horizontal align='center' className={styles.pagination} gap={16} justify='space-between'>
            <Text type='secondary'>
              第 {rangeStart}-{rangeEnd} 条，共 {total} 条
            </Text>
            <Pagination
              current={page}
              pageSize={pageSize}
              pageSizeOptions={[10, 20, 50, 100]}
              showSizeChanger
              total={total}
              onChange={(nextPage, nextPageSize) => {
                setPage(nextPageSize === pageSize ? nextPage : 1)
                setPageSize(nextPageSize)
              }}
            />
          </Flexbox>
        </Block>
      </Block>
    </Flexbox>
  )
}
