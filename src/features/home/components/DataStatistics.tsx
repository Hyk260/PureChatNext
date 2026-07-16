'use client'

import { Flexbox } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo, type ReactNode } from 'react'
import useSWR from 'swr'

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
    font-size: 16px;
    font-weight: bold;
    line-height: 1.2;
  `,
  title: css`
    font-size: 12px;
    line-height: 1.2;
    color: ${cssVar.colorTextDescription};
  `,
}))

const formatShortenNumber = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(value)
}

const fetchUserStats = async (): Promise<UserStats> => {
  const res = await apiFetch('/api/user/stats')
  if (!res.ok) throw new Error(`fetchUserStats failed: ${res.status}`)
  return res.json() as Promise<UserStats>
}

const StatCard = memo<{ count: ReactNode; title: string }>(({ count, title }) => (
  <Flexbox className={styles.card} flex={1} gap={2}>
    <div className={styles.count}>{count}</div>
    <div className={styles.title}>{title}</div>
  </Flexbox>
))

StatCard.displayName = 'StatCard'

const DataStatistics = memo(() => {
  const { data, isLoading } = useSWR<UserStats>('user-stats', fetchUserStats, {
    revalidateOnFocus: false,
  })

  const placeholder = '—'
  const agents = isLoading || data === undefined ? placeholder : formatShortenNumber(data.agents)
  const topics = isLoading || data === undefined ? placeholder : formatShortenNumber(data.topics)
  const messages =
    isLoading || data === undefined ? placeholder : formatShortenNumber(data.messages)

  return (
    <Flexbox
      horizontal
      align='center'
      gap={4}
      paddingInline={8}
      style={{ marginBottom: 8 }}
      width='100%'
    >
      <StatCard count={agents} title='助理' />
      <StatCard count={topics} title='话题' />
      <StatCard count={messages} title='消息' />
    </Flexbox>
  )
})

DataStatistics.displayName = 'DataStatistics'

export default DataStatistics
