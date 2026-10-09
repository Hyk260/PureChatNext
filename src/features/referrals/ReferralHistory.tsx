import { Button, Select } from '@pure/ui'
import { Spin } from 'antd'
import { ArrowLeft, Copy } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { ReferralBatchResponse, ReferralHistoryResponse, ReferralItem } from '@pure/types'
import { useApp } from '@/components/AntdStaticMethods'
import { REFERRAL_DAYS, REFERRAL_STATUS_LABELS } from '@/libs/referrals/helpers'

import { referralRequest } from './api'

const RANGE_OPTIONS = REFERRAL_DAYS.map((days) => ({ value: days, label: days ? `过去 ${days} 天` : '全部' }))

export function ReferralHistory({ onBack }: { onBack: () => void }) {
  const { message } = useApp()
  const [days, setDays] = useState(90)
  const [data, setData] = useState<ReferralHistoryResponse>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [resending, setResending] = useState<string | null>(null)
  const retryRef = useRef<{ id: string; key: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true)
      setError('')
      try {
        const query = new URLSearchParams({ days: String(days) })
        if (cursor) query.set('cursor', cursor)
        const result = await referralRequest<ReferralHistoryResponse>(`?${query}`)
        setData((previous) =>
          cursor && previous ? { ...result, items: [...previous.items, ...result.items] } : result
        )
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : '加载邀请失败')
      } finally {
        setLoading(false)
      }
    },
    [days]
  )

  useEffect(() => {
    let cancelled = false
    referralRequest<ReferralHistoryResponse>(`?days=${days}`)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : '加载邀请失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [days])

  const copy = async (item: ReferralItem) => {
    if (!item.link) return
    try {
      await navigator.clipboard.writeText(item.link)
      setCopied(item.id)
      message.success('邀请链接已复制')
    } catch {
      message.error('无法复制，请检查浏览器剪贴板权限')
    }
  }

  const resend = async (item: ReferralItem) => {
    setResending(item.id)
    if (retryRef.current?.id !== item.id) retryRef.current = { id: item.id, key: crypto.randomUUID() }
    try {
      const result = await referralRequest<ReferralBatchResponse>('/resend', {
        id: item.id,
        requestKey: retryRef.current!.key,
      })
      retryRef.current = null
      const first = result.results[0]
      if (first?.invitation?.status === 'sent') message.success('邀请已重新发送')
      else message.warning(first?.error || first?.invitation?.error || '发送结果待确认')
      await load()
    } catch (requestError) {
      message.error(requestError instanceof Error ? requestError.message : '重发失败')
    } finally {
      setResending(null)
    }
  }

  const reload = () => load()
  const changeDays = (value: number) => {
    setData(undefined)
    setError('')
    setLoading(true)
    setDays(value)
  }

  return (
    <section className='flex min-h-[440px] flex-col gap-6 p-6 sm:p-10'>
      <Button type='text' icon={<ArrowLeft size={16} />} onClick={onBack} className='self-start'>
        返回
      </Button>
      <div className='flex items-center justify-between gap-4'>
        <h2 className='m-0 whitespace-nowrap text-xl font-semibold'>查看你的邀请</h2>
        <Select
          aria-label='邀请历史时间范围'
          className='w-40!'
          options={RANGE_OPTIONS}
          value={days}
          onChange={changeDays}
          disabled={loading || resending !== null}
        />
      </div>
      {error ? (
        <div role='alert'>
          <p>{error}</p>
          <Button onClick={reload}>重新加载</Button>
        </div>
      ) : null}
      {loading && !data ? <Spin /> : null}
      {data && !data.items.length ? (
        <p className='py-12 text-center text-muted-foreground'>暂无邀请，邀请好友一起使用 PureChat 吧。</p>
      ) : null}
      <ul className='m-0 flex list-none flex-col gap-5 p-0'>
        {data?.items.map((item) => (
          <li key={item.id} className='flex flex-wrap items-center gap-3'>
            <div className='flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary'>
              {item.email.slice(0, 1).toUpperCase()}
            </div>
            <div className='min-w-0 flex-1'>
              <div className='break-all'>{item.email}</div>
              <div className='text-xs text-muted-foreground'>{new Date(item.createdAt).toLocaleString()}</div>
              {item.error ? <div className='text-xs text-muted-foreground'>{item.error}</div> : null}
            </div>
            <span className='text-sm text-muted-foreground'>{REFERRAL_STATUS_LABELS[item.status]}</span>
            {item.link ? (
              <Button icon={<Copy size={14} />} onClick={() => copy(item)}>
                {copied === item.id ? '已复制' : '复制链接'}
              </Button>
            ) : null}
            {item.canResend ? (
              <Button loading={resending === item.id} disabled={resending !== null} onClick={() => resend(item)}>
                重新发送
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {data?.nextCursor ? (
        <Button loading={loading} onClick={() => load(data.nextCursor!)}>
          加载更多
        </Button>
      ) : null}
    </section>
  )
}
