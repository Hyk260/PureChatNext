'use client'

import { getErrorMessage } from '@pure/utils/error'

import { Block, Button, Flexbox as Flex, Icon, Table, Text, toast } from '@lobehub/ui'
import { Input, Skeleton } from '@pure/ui'
import type { TableProps } from '@lobehub/ui'
import type { ReferralRecordsResponse, ReferralRewardRecord, ReferralSummary } from '@pure/types'
import { formatCompactDateTime, formatDate as formatCalendarDate, formatNumber } from '@pure/utils/client'
import { REFERRAL_REWARD_CREDITS } from '@pure/const'
import { Copy, Gift } from 'lucide-react'
import { useState } from 'react'
import useSWR from 'swr'

import { referralRequest } from '@/features/referrals/api'
import { useSession } from '@/libs/better-auth/client'

const STATUS_LABELS: Record<ReferralRewardRecord['status'], string> = {
  pending: '待验证邮箱',
  rewarded: '已奖励',
  ineligible: '未满足奖励条件',
}
const formatDate = (value: string | null) => (value ? formatCompactDateTime(value, { timeZone: 'Asia/Shanghai' }) : '—')
const formatRebateExpiryDate = (value: string) => formatCalendarDate(value, { timeZone: 'Asia/Shanghai' })
const referralRules = [
  { label: '注册方式', description: '好友通过你的邀请链接注册，或在注册页输入你的邀请码。' },
  { label: '有效邀请', description: '好友通过邀请链接或邀请码注册，并完成邮箱验证。' },
  {
    label: '奖励',
    description: `你和好友各得 ${formatNumber(REFERRAL_REWARD_CREDITS)} 积分。`,
  },
  { label: '发放时间', description: '好友完成邮箱验证后发放积分。' },
  { label: '积分使用顺序', description: '免费积分优先使用，用完后再使用返利积分。' },
  { label: '有效期', description: '账号连续 90 天未活跃后，返利积分将被清除。' },
  { label: '反滥用', description: '若存在作弊行为（如使用临时邮箱批量注册），相关账号将被永久封禁。' },
] as const
const columns: TableProps<ReferralRewardRecord>['columns'] = [
  { title: '注册时间', dataIndex: 'createdAt', render: formatDate, width: 170 },
  { title: '被邀请人邮箱', dataIndex: 'maskedEmail', width: 180 },
  { title: '状态', key: 'status', render: (_, record) => STATUS_LABELS[record.status], width: 150 },
  {
    title: '我的奖励',
    key: 'amount',
    render: (_, record) => (record.rewardedAt ? formatNumber(record.amount) : '—'),
    width: 100,
  },
  { title: '奖励时间', dataIndex: 'rewardedAt', render: formatDate, width: 170 },
]

async function copyReferral(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success('已复制')
  } catch {
    toast.error('无法复制，请检查浏览器剪贴板权限')
  }
}

function ShareField({ title, description, value }: { title: string; description: string; value: string }) {
  return (
    <Flex direction='vertical' gap={12}>
      <Flex direction='vertical' gap={4}>
        {/* <Text as='h3' fontSize={15} weight={600} className='m-0'>
          {title}
        </Text> */}
        <Text type='secondary' fontSize={13}>
          {description}
        </Text>
      </Flex>
      <Flex horizontal align='center' gap={8} className='min-w-0'>
        <Input aria-label={title} readOnly value={value} className='min-w-0 flex-1 font-mono' size='large' />
        <Button aria-label={`复制${title}`} icon={<Copy size={16} />} onClick={() => copyReferral(value)}>
          复制
        </Button>
      </Flex>
    </Flex>
  )
}

export function ReferralSettingsContent() {
  const { data: session, isPending: sessionPending } = useSession()
  const userId = session?.user?.id
  const [page, setPage] = useState(1)
  const summaryRequest = useSWR<ReferralSummary>(
    userId ? ['referral-summary', userId] : null,
    () => referralRequest<ReferralSummary>('/summary'),
    { revalidateOnFocus: false }
  )
  const recordsRequest = useSWR<ReferralRecordsResponse>(
    userId ? ['referral-records', userId, page] : null,
    () => referralRequest<ReferralRecordsResponse>(`/records?page=${page}`),
    { keepPreviousData: true, revalidateOnFocus: false }
  )
  const summary = summaryRequest.data
  const records = recordsRequest.data
  const loading = sessionPending || summaryRequest.isLoading || recordsRequest.isLoading
  const error = summaryRequest.error ?? recordsRequest.error
  const retry = async () => {
    await Promise.allSettled([summaryRequest.mutate(), recordsRequest.mutate()])
  }
  const changePage = (nextPage: number) => setPage(nextPage)
  const metrics = summary
    ? [
        { label: '已绑定邀请', value: String(summary.totalInvited) },
        { label: '已奖励邀请', value: String(summary.totalRewarded) },
        { label: '累计奖励', value: formatNumber(summary.totalEarned) },
        { label: '返利可用余额', value: formatNumber(summary.rebateRemaining) },
      ]
    : []

  return (
    <Flex direction='vertical' gap={6} className='w-full px-4 pt-5 pb-16 sm:px-6'>
      <Block
        variant='outlined'
        className='rounded-2xl p-5 sm:p-6'
        horizontal
        align='center'
        gap={16}
      >
        <Icon icon={Gift} size={36} className='shrink-0' />
        <Flex direction='vertical' gap={8}>
          <Text as='h1' fontSize={22} weight={600} className='m-0'>
            邀请好友，双方各得 0.5M 积分
          </Text>
          <Text type='secondary'>好友通过邀请完成邮箱注册并验证后，你和好友各得 500,000 积分。</Text>
          <Text type='secondary' fontSize={13}>
            先使用每月免费积分，再使用返利。返利跨月保留，账号连续 90 天未活跃后清除。
            登录或访问已登录功能可续期；新奖励到账重新计算 90 天。
          </Text>
        </Flex>
      </Block>
      {error ? (
        <Flex direction='vertical' gap={12} role='alert'>
          <Text type='danger'>{getErrorMessage(error, '推荐奖励加载失败')}</Text>
          <Button onClick={retry} className='self-start'>
            重新加载
          </Button>
        </Flex>
      ) : null}
      {loading && !summary ? (
        <Block variant='outlined' className='rounded-2xl p-5 sm:p-6'>
          <Skeleton.Text rows={6} />
        </Block>
      ) : null}
      {summary ? (
        <Block variant='outlined' className='rounded-2xl p-5 sm:p-6' gap={16}>
          <Text as='h2' fontSize={17} weight={600} className='m-0'>
            邀请分享
          </Text>
          <ShareField
            title='你的邀请链接'
            description='复制并分享，好友完成邮箱注册和验证后双方获得奖励。'
            value={summary.link}
          />
          <div className='border-t border-app-border-secondary' />
          <ShareField
            title='你的邀请码'
            description='好友也可在注册时手动填写邀请码；邀请码不可修改。'
            value={summary.code}
          />
        </Block>
      ) : null}
      <Block variant='outlined' className='rounded-2xl p-5 sm:p-6' gap={16}>
        <Text as='h2' fontSize={17} weight={600} className='m-0'>
          推荐奖励计划规则
        </Text>
        <ol className='m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2'>
          {referralRules.map((rule, index) => (
            <li key={rule.label} className='flex min-w-0 gap-3 rounded-xl bg-background p-3'>
              <span
                aria-hidden='true'
                className='flex-center size-7 shrink-0 rounded-full bg-primary/10 text-sm font-semibold text-primary'
              >
                {index + 1}
              </span>
              <Flex direction='vertical' gap={2} className='min-w-0'>
                <Text weight={600}>{rule.label}</Text>
                <Text type='secondary' fontSize={13}>
                  {rule.description}
                </Text>
              </Flex>
            </li>
          ))}
        </ol>
      </Block>
      {summary ? (
        <>
          <Block variant='outlined' className='rounded-2xl p-5 sm:p-6' gap={16}>
            <Text as='h2' fontSize={16} weight={600} className='m-0'>
              推荐概览
            </Text>
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4'>
              {metrics.map((metric) => (
                <Flex
                  key={metric.label}
                  direction='vertical'
                  gap={2}
                  className='min-w-0 rounded-xl border border-app-border-secondary bg-background p-4'
                >
                  <Text fontSize={24} weight={600} className='tabular-nums'>
                    {metric.value}
                  </Text>
                  <Text type='secondary' fontSize={13}>
                    {metric.label}
                  </Text>
                </Flex>
              ))}
            </div>
            {summary.rebateRemaining > 0 && summary.rebateExpiresAt ? (
              <Text type='secondary' fontSize={12}>
                若不再活跃，当前返利将于 {formatRebateExpiryDate(summary.rebateExpiresAt)} 清除。
              </Text>
            ) : null}
          </Block>
        </>
      ) : null}
      <Block variant='outlined' className='rounded-2xl p-5 sm:p-6' gap={16}>
        <Text as='h2' fontSize={16} weight={600} className='m-0'>
          推荐记录
        </Text>
        <Table<ReferralRewardRecord>
          variant='outlined'
          columns={columns}
          dataSource={records?.items ?? []}
          rowKey='id'
          loading={recordsRequest.isLoading}
          pagination={false}
          scroll={{ x: 770 }}
          locale={{ emptyText: recordsRequest.error ? '加载失败，请重试' : '暂无推荐记录，邀请好友一起使用 PureChat 吧。' }}
        />
        <Flex horizontal align='center' justify='flex-end' gap={12}>
          <Button disabled={recordsRequest.isLoading || page === 1} onClick={() => changePage(page - 1)}>
            上一页
          </Button>
          <Text type='secondary'>第 {records?.page ?? page} 页</Text>
          <Button disabled={recordsRequest.isLoading || !records?.hasMore} onClick={() => changePage(page + 1)}>
            下一页
          </Button>
        </Flex>
      </Block>
    </Flex>
  )
}
