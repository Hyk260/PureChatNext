'use client'

import { Progress, Spin } from 'antd'
import { Text, Flexbox } from '@pure/ui'
import { useEffect, useState } from 'react'

import { SettingHeader } from '@/features/settings/profile/components/SettingHeader'

type CreditsResponse = {
  grant: number
  period: string
  remaining: number
  resetAt: string
  resetIn: { days: number; hours: number }
  used: number
}

const formatNumber = (n: number) => n.toLocaleString('zh-CN')

export function CreditsSettingsContent() {
  const [data, setData] = useState<CreditsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/user/credits', { credentials: 'include' })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null
          throw new Error(body?.message || body?.error || `HTTP ${res.status}`)
        }
        const json = (await res.json()) as CreditsResponse
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const percent = data ? Math.min(100, Math.round((data.used / Math.max(1, data.grant)) * 100)) : 0

  return (
    <Flexbox gap={24} style={{ paddingBlock: '24px 64px', paddingInline: 24, width: '100%' }}>
      <SettingHeader title='免费积分' />
      <Text type='secondary'>
        每月免费积分用于 PureChat 官方模型；用尽后可等待下月重置，或自行配置 OpenAI / DeepSeek API
        Key。本页不提供购买入口。
      </Text>

      {loading ? (
        <Spin />
      ) : error ? (
        <Text type='danger'>{error}</Text>
      ) : data ? (
        <Flexbox gap={16} style={{ maxWidth: 480 }}>
          <Flexbox gap={4}>
            <Text style={{ fontSize: 28, fontWeight: 600 }}>{formatNumber(data.remaining)}</Text>
            <Text type='secondary'>剩余 / 本月额度 {formatNumber(data.grant)}</Text>
          </Flexbox>
          <Progress percent={percent} showInfo format={() => `已用 ${formatNumber(data.used)}`} />
          <Text type='secondary'>
            计费周期 {data.period}（Asia/Shanghai）· 下次重置约 {data.resetIn.days} 天 {data.resetIn.hours} 小时
          </Text>
        </Flexbox>
      ) : null}
    </Flexbox>
  )
}
