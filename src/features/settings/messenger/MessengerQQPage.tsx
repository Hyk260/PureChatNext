'use client'

import { Spin } from 'antd'
import { Alert, Button, confirmModal, Select, Text, copyToClipboard, Flex } from '@pure/ui'
import { Highlighter } from '@pure/ui/Markdown'
import { useApp } from '@/components/AntdStaticMethods'
import type { AgentListItem } from '@/const/home/agents'
import { Trash2Icon } from 'lucide-react'
import type { ReactNode } from 'react'
import { memo, useCallback, useEffect, useState } from 'react'
import useSWR from 'swr'

import { useSession } from '@/libs/better-auth/client'
import { markFirstConversion, trackAcquisitionEvent } from '@/libs/analytics/acquisition'

import { fetchAgents } from '@/features/home/agentApi'

import {
  formatMessengerActiveAt,
  getMessengerPlatform,
  isMessengerProviderId,
  QQ_DEFAULT_MODEL,
  QQ_DEFAULT_PROVIDER,
} from './const'
import MessengerCommandList from './MessengerCommandList'
import { MessengerDetailShell } from './MessengerDetailShell'
import { MessengerModelSwitch } from './MessengerModelSwitch'
import { QQConnectButton } from './QQConnectModal'
import { fetchQQStatus, unbindQQ, updateQQConfiguration } from './qqApi'
import type { QQProviderId, QQStatus } from './qqApi'

function qqConnectHint(gatewaySupported: boolean) {
  if (gatewaySupported) {
    return {
      title: '支持扫码、WebSocket 与 URL 回调',
      description: '点击右上角「连接」，使用手机 QQ 扫码自动完成机器人授权。',
    }
  }
  return {
    title: '当前部署仅支持 URL 回调',
    description: '扫码和 WebSocket 需要常驻 Gateway；点击右上角「连接」可使用 App ID / Secret 配置 URL 回调。',
  }
}

function qqBoundDescription(status: QQStatus) {
  const mode = status.connectionMode ?? 'websocket'
  if (status.lastActiveAt) {
    return `最近活动：${formatMessengerActiveAt(status.lastActiveAt)} · 模式：${mode}`
  }
  return `模式：${mode}。在 QQ 私聊或群内 @ 机器人即可对话。`
}

function renderQqStatusBanner(params: {
  connected: boolean
  gatewaySupported: boolean
  message: { success: (content: string) => void }
  showConnect: boolean
  status: QQStatus | null
}): ReactNode {
  const { connected, gatewaySupported, message, showConnect, status } = params

  if (showConnect) {
    return <Alert showIcon type='info' {...qqConnectHint(gatewaySupported)} />
  }

  const boundType = connected ? 'success' : 'warning'
  const boundTitle = connected ? '已连接 QQ' : 'QQ 绑定已保存，当前离线'
  const webhookUrl = status?.connectionMode === 'webhook' ? status.webhookUrl : undefined
  const showWebsocketOffline = status?.connectionMode === 'websocket' && status.runtimeStatus !== 'online'

  return (
    <>
      <Alert
        showIcon
        type={boundType}
        title={boundTitle}
        description={status ? qqBoundDescription(status) : undefined}
      />
      {webhookUrl ? (
        <Alert
          showIcon
          type='info'
          title='Webhook 回调地址'
          description={
            <Text
              style={{ cursor: 'copy', fontSize: 13 }}
              title='点击复制'
              onClick={async () => {
                await copyToClipboard(webhookUrl)
                message.success('已复制 Webhook 回调地址')
              }}
            >
              {webhookUrl}
            </Text>
          }
        />
      ) : null}
      {showWebsocketOffline ? (
        <Alert
          showIcon
          type='warning'
          title='QQ WebSocket 当前离线'
          description={status?.lastError?.message || 'Next Server Gateway 正在等待连接或恢复。'}
          extra={
            status ? (
              <Highlighter actionIconSize={'small'} language={'json'} padding={8} variant={'borderless'}>
                {JSON.stringify(status?.lastError, null, 2)}
              </Highlighter>
            ) : null
          }
        />
      ) : null}
    </>
  )
}

const DISCONNECTED_STATUS: QQStatus = {
  connected: false,
  gatewaySupported: false,
}

const MessengerQQPage = memo(() => {
  const { message } = useApp()
  const platformMeta = getMessengerPlatform('qq')!
  const { data: session } = useSession()
  const userId = session?.user?.id
  const [binding, setBinding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [agentId, setAgentId] = useState('agt_inbox')
  const [provider, setProvider] = useState<QQProviderId>(QQ_DEFAULT_PROVIDER)
  const [modelId, setModelId] = useState(QQ_DEFAULT_MODEL)

  const {
    data: status,
    error: statusError,
    isLoading: statusLoading,
    mutate: mutateStatus,
  } = useSWR<QQStatus>(userId ? ['messenger-qq-status', userId] : null, () => fetchQQStatus(), {
    revalidateOnFocus: false,
  })
  const {
    data: agentList,
    error: agentsError,
    isLoading: agentsLoading,
  } = useSWR<AgentListItem[]>(userId ? ['messenger-agents', userId] : null, fetchAgents, {
    revalidateOnFocus: false,
  })
  const agents = agentList?.map((agent) => ({ label: agent.title, value: agent.id })) ?? []
  const loading = !userId || statusLoading || agentsLoading

  useEffect(() => {
    const error = statusError ?? agentsError
    if (!error || status || agentList?.length) return
    message.error(error instanceof Error ? error.message : '加载失败')
  }, [agentList?.length, agentsError, message, status, statusError])

  useEffect(() => {
    if (status?.agentId) setAgentId(status.agentId)
    else if (agentList?.[0]) setAgentId((current) => (current === 'agt_inbox' ? agentList[0].id : current))
    if (status?.provider && isMessengerProviderId(status.provider)) setProvider(status.provider)
    if (status?.model) setModelId(status.model)
  }, [agentList, status])

  const refreshStatus = useCallback(async () => {
    if (!userId) throw new Error('登录状态尚未准备好')
    const nextStatus = await mutateStatus()
    if (!nextStatus) throw new Error('QQ 状态暂时不可用')
    return nextStatus
  }, [mutateStatus, userId])

  const saveConfiguration = useCallback(
    async (
      next: { agentId: string; model: string; provider: QQProviderId },
      previous: { agentId: string; model: string; provider: QQProviderId }
    ) => {
      if (!status?.applicationId || status.enabled === false) return
      setSaving(true)
      try {
        await updateQQConfiguration(next)
        message.success('已更新 QQ 渠道配置')
        await refreshStatus()
      } catch (error) {
        setAgentId(previous.agentId)
        setProvider(previous.provider)
        setModelId(previous.model)
        message.error(error instanceof Error ? error.message : '更新失败')
      } finally {
        setSaving(false)
      }
    },
    [message, refreshStatus, status]
  )

  const handleAgentChange = useCallback(
    (value: string) => {
      const previous = { agentId, model: modelId, provider }
      setAgentId(value)
      void saveConfiguration({ ...previous, agentId: value }, previous)
    },
    [agentId, modelId, provider, saveConfiguration]
  )

  const handleModelSelect = useCallback(
    (nextProvider: string, nextModel: string) => {
      if (!isMessengerProviderId(nextProvider)) return
      const previous = { agentId, model: modelId, provider }
      setProvider(nextProvider)
      setModelId(nextModel)
      void saveConfiguration({ agentId, model: nextModel, provider: nextProvider }, previous)
    },
    [agentId, modelId, provider, saveConfiguration]
  )

  const handleConnected = useCallback(async () => {
    setBinding(true)
    try {
      message.success('QQ 凭证已保存，正在建立连接')
      await refreshStatus()
      trackAcquisitionEvent('channel_connected', {
        first: markFirstConversion('channel_connected'),
        platform: 'qq',
      })
    } finally {
      setBinding(false)
    }
  }, [message, refreshStatus])

  const handleDisconnect = useCallback(() => {
    confirmModal({
      content: '断开后需重新填写 App ID / Secret 才能在 QQ 中对话。',
      okText: '断开',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await unbindQQ()
        await mutateStatus(DISCONNECTED_STATUS, { revalidate: false })
        message.success('已断开 QQ')
        try {
          await refreshStatus()
        } catch {
          /* 已乐观断开 */
        }
      },
      title: '断开 QQ 连接？',
    })
  }, [message, mutateStatus, refreshStatus])

  if (loading) {
    return (
      <MessengerDetailShell platform='qq' platformMeta={platformMeta}>
        <Flex className='flex-col-center min-h-[160px]'>
          <Spin />
        </Flex>
      </MessengerDetailShell>
    )
  }

  const connected = Boolean(status?.connected)
  const gatewaySupported = status?.gatewaySupported !== false
  const showConnect = !status?.applicationId
  const controlsDisabled = binding || saving

  const headerAction = showConnect ? (
    <QQConnectButton
      agentId={agentId}
      gatewaySupported={gatewaySupported}
      model={modelId}
      provider={provider}
      onConnected={handleConnected}
    />
  ) : (
    <Button danger disabled={binding} icon={<Trash2Icon size={16} />} onClick={handleDisconnect}>
      断开
    </Button>
  )

  return (
    <MessengerDetailShell headerAction={headerAction} platform='qq' platformMeta={platformMeta}>
      <Flex className='flex-col gap-3'>
        <Text strong style={{ fontSize: 15 }}>
          连接 QQ
        </Text>

        <Flex className='flex-col gap-2'>
          <Text type='secondary' style={{ fontSize: 13 }}>
            绑定助手
          </Text>
          <Select
            disabled={controlsDisabled}
            options={agents}
            style={{ maxWidth: 300, width: '100%' }}
            value={agentId}
            onChange={(v) => void handleAgentChange(v)}
          />
        </Flex>

        <MessengerModelSwitch
          disabled={controlsDisabled}
          modelId={modelId}
          provider={provider}
          onSelect={handleModelSelect}
        />

        {renderQqStatusBanner({ connected, gatewaySupported, message, showConnect, status: status ?? null })}
      </Flex>

      <MessengerCommandList platform='qq' />
    </MessengerDetailShell>
  )
})

MessengerQQPage.displayName = 'MessengerQQPage'

export default MessengerQQPage
