'use client'

import { Progress } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'
import useSWR from 'swr'

import { Text, Flex } from '@pure/ui'

import Link from '@/utils/link'
import { apiFetch } from '@/utils/apiFetch'

type CreditsSummary = {
  grant: number
  used: number
}

const styles = createStaticStyles(({ css }) => ({
  link: css`
    display: block;
    margin-block: 4px;
    margin-inline: 4px;
    border-radius: 8px;
    color: inherit;
    text-decoration: none;

    &:hover {
      color: inherit;
      background: ${cssVar.colorFillTertiary};
    }
  `,
  row: css`
    box-sizing: border-box;
    min-height: 2rem;
    padding-block: 0.375rem;
    padding-inline: 0.75rem;
  `,
  value: css`
    font-variant-numeric: tabular-nums;
    line-height: 2;
  `,
}))

const fetchCredits = async (): Promise<CreditsSummary> => {
  const res = await apiFetch('/api/user/credits')
  if (!res.ok) throw new Error(`fetchCredits failed: ${res.status}`)
  return res.json() as Promise<CreditsSummary>
}

const formatMillions = (value: number) => `${(value / 1_000_000).toFixed(1)}M`

const FreeCreditsSummary = memo<{ onClick?: () => void }>(({ onClick }) => {
  const { data, isLoading } = useSWR<CreditsSummary>('user-credits', fetchCredits, {
    revalidateOnFocus: false,
  })

  const percent = data ? Math.min(100, Math.round((data.used / Math.max(1, data.grant)) * 100)) : 0
  const value = isLoading
    ? '加载中'
    : data
      ? `${formatMillions(data.used)} / ${formatMillions(data.grant)}`
      : '暂不可用'

  return (
    <Link className={styles.link} href='/settings/usage' onClick={onClick}>
      <Flex className={[styles.row, 'flex-between']}>
        <Text type='secondary'>积分</Text>
        <Flex className='flex-row items-center gap-2.5'>
          <Text className={styles.value}>{value}</Text>
          <Progress percent={percent} showInfo={false} size={16} strokeWidth={12} type='circle' />
        </Flex>
      </Flex>
    </Link>
  )
})

FreeCreditsSummary.displayName = 'FreeCreditsSummary'

export default FreeCreditsSummary
