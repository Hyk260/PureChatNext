'use client'

import { Progress, cssVar } from '@lobehub/ui'
import { Text, Flex } from '@pure/ui'
import { formatDateTime } from '@pure/utils/client'
import { Monitor } from 'lucide-react'
import { memo, useEffect, useMemo, useState } from 'react'

import { countBusyTopics, useChatRuntimeStore } from '@/features/chat/runtime/store'
import type { LocalChatTopic } from '@/features/chat/types'
import { getDesktopApi } from '@/types/desktop'
import type { DesktopSystemMetrics } from '@/types/desktop'

const PLATFORM_LABELS: Partial<Record<NodeJS.Platform, string>> = {
  darwin: 'macOS',
  linux: 'Linux',
  win32: 'Windows',
}

type ResourceProgressRowProps = {
  color: string
  label: string
  percent: number | null
}

const ResourceProgressRow = memo<ResourceProgressRowProps>(({ color, label, percent }) => (
  <Flex className='items-center gap-3'>
    <Text className='w-24 shrink-0' type='secondary'>
      {label}
    </Text>
    <Progress
      aria-label={label}
      aria-valuetext={percent === null ? '正在采样' : `${percent}%`}
      className='min-w-0 flex-1'
      percent={percent ?? 0}
      segments={36}
      showInfo={false}
      size='middle'
      strokeColor={color}
      variant='segments'
    />
    <Text
      className='w-10 shrink-0 text-right tabular-nums'
      style={{ color }}
      type={percent === null ? 'secondary' : undefined}
    >
      {percent === null ? '—' : `${percent}%`}
    </Text>
  </Flex>
))

ResourceProgressRow.displayName = 'ResourceProgressRow'

const SystemResourceCard = memo(() => {
  const [metrics, setMetrics] = useState<DesktopSystemMetrics | null>(null)
  const busyTopicCount = useChatRuntimeStore((state) => countBusyTopics(state.busy))
  const desktopApi = getDesktopApi()

  useEffect(() => {
    const api = getDesktopApi()
    if (!api?.getSystemMetrics) return

    let disposed = false
    let requestPending = false
    const refreshMetrics = async () => {
      if (requestPending) return
      requestPending = true
      try {
        const nextMetrics = await api.getSystemMetrics()
        if (!disposed) setMetrics(nextMetrics)
      } catch {
        if (!disposed) setMetrics(null)
      } finally {
        requestPending = false
      }
    }

    refreshMetrics()
    const interval = window.setInterval(refreshMetrics, 3_000)
    return () => {
      disposed = true
      window.clearInterval(interval)
    }
  }, [])

  if (!desktopApi?.getSystemMetrics) return null

  const hostname = metrics?.hostname ?? '—'
  const platformLabel = metrics ? (PLATFORM_LABELS[metrics.platform] ?? metrics.platform) : null
  const systemLabel = metrics ? `在线 · 已连接 · ${platformLabel} · ${metrics.arch}` : '在线 · 正在读取系统信息'

  return (
    <section
      aria-label='本机资源概览'
      className='flex flex-col gap-3 rounded-xl border border-app-border-secondary bg-app-surface p-4 shadow-sm'
    >
      <Flex className='min-w-0 items-center gap-3'>
        <div className='flex size-10 shrink-0 items-center justify-center rounded-xl border border-app-border-secondary bg-app-layout'>
          <Monitor aria-hidden='true' size={18} style={{ color: cssVar.colorTextSecondary }} />
        </div>
        <div className='flex min-w-0 flex-1 flex-col gap-1'>
          <Text className='truncate' fontSize={14} title={metrics?.hostname ?? '本机'} weight={600}>
            {metrics?.hostname ?? '本机'}
          </Text>
          <Flex className='min-w-0 items-center gap-1.5'>
            <span aria-hidden='true' className='size-1.5 shrink-0 rounded-full bg-green' />
            <Text className='truncate' fontSize={12} title={systemLabel} type='secondary'>
              {systemLabel}
            </Text>
          </Flex>
        </div>
      </Flex>
      <Flex className='flex-col gap-2'>
        <Flex className='flex-between gap-3'>
          <Text type='secondary'>主机名</Text>
          <Text className='max-w-[65%] truncate text-right' title={hostname}>
            {hostname}
          </Text>
        </Flex>
        <Flex className='flex-between gap-3'>
          <Text type='secondary'>运行中的话题</Text>
          <Text className='text-right tabular-nums'>{busyTopicCount}</Text>
        </Flex>
      </Flex>
      <Flex className='flex-col gap-2'>
        <ResourceProgressRow
          color={cssVar.colorSuccess}
          label='CPU 使用率'
          percent={metrics?.cpuUsagePercent ?? null}
        />
        <ResourceProgressRow
          color={cssVar.colorWarning}
          label='内存使用率'
          percent={metrics?.memoryUsagePercent ?? null}
        />
      </Flex>
    </section>
  )
})

SystemResourceCard.displayName = 'SystemResourceCard'

type Props = {
  topic: LocalChatTopic | null
  topicTitle: string
}

const OverviewContent = memo<Props>(({ topic, topicTitle }) => {
  const rows = useMemo(() => {
    const items: { label: string; value: string }[] = [{ label: '话题', value: topicTitle || '新话题' }]
    if (topic?.projectName) items.push({ label: '项目', value: topic.projectName })
    else items.push({ label: '项目', value: '未绑定项目' })
    if (topic) {
      items.push({ label: '创建时间', value: formatDateTime(topic.createdAt) })
      items.push({ label: '更新时间', value: formatDateTime(topic.updatedAt) })
    }
    return items
  }, [topic, topicTitle])

  return (
    <Flex className='flex-col gap-3 p-4 min-h-0 overflow-auto'>
      <SystemResourceCard />
      <Flex className='flex-col gap-2'>
        <Text className='font-medium'>会话概览</Text>
        {rows.map((row) => (
          <Flex className='flex-between gap-3' key={row.label}>
            <Text type='secondary'>{row.label}</Text>
            <Text className='text-right' ellipsis>
              {row.value}
            </Text>
          </Flex>
        ))}
      </Flex>
    </Flex>
  )
})

OverviewContent.displayName = 'OverviewContent'

export default OverviewContent
