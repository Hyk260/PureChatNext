'use client'

import { createStaticStyles, cssVar } from 'antd-style'
import { Flex } from '@pure/ui'
import { memo } from 'react'
import type { ReactNode } from 'react'
import useSWR from 'swr'

import { formatShortenNumber } from '@pure/utils/client'

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading'
import { apiFetch } from '@/utils/apiFetch'

export type UserStats = {
  agents: number
  messages: number
  topics: number
}

const styles = createStaticStyles(({ css }) => ({
  card: css`
    padding-block: 6px;
    padding-inline: 8px;
    border-radius: ${cssVar.borderRadius};
    background: ${cssVar.colorFillTertiary};
  `,
  count: css`
    display: flex;
    align-items: center;
    min-height: 20px;
    font-size: 16px;
    font-weight: bold;
    line-height: 20px;
  `,
  title: css`
    font-size: 12px;
    line-height: 1.2;
    color: ${cssVar.colorTextDescription};
  `,
}))

const fetchUserStats = async (): Promise<UserStats> => {
  const res = await apiFetch('/api/user/stats')
  if (!res.ok) throw new Error(`fetchUserStats failed: ${res.status}`)
  return res.json() as Promise<UserStats>
}

const StatCard = memo<{ count: ReactNode; title: string }>(({ count, title }) => (
  <Flex className={[styles.card, 'flex-col flex-1 gap-0.5']}>
    <div className={styles.count}>{count}</div>
    <div className={styles.title}>{title}</div>
  </Flex>
))

StatCard.displayName = 'StatCard'

const DataStatistics = memo(() => {
  const { data, isLoading } = useSWR<UserStats>('user-stats', fetchUserStats, {
    revalidateOnFocus: false,
  })

  const renderCount = (value: number | undefined): ReactNode => {
    if (isLoading) return <NeuralNetworkLoading size={16} />
    if (value === undefined) return '—'
    return formatShortenNumber(value)
  }

  const agents = renderCount(data?.agents)
  const topics = renderCount(data?.topics)
  const messages = renderCount(data?.messages)

  return (
    <Flex className='flex-row items-center gap-1 px-2 w-full' style={{ marginBottom: 8 }}>
      <StatCard count={agents} title='助理' />
      <StatCard count={topics} title='话题' />
      <StatCard count={messages} title='消息' />
    </Flex>
  )
})

DataStatistics.displayName = 'DataStatistics'

export default DataStatistics
