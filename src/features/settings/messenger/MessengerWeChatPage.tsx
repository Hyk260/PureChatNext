'use client'

import { Spin } from 'antd'
import { Alert, Button, confirmModal, Select, Text, Flex } from '@pure/ui'
import { useApp } from '@/components/AntdStaticMethods'
import type { AgentListItem } from '@/const/home/agents'
import { isDev } from '@/libs/constants'
import { MessagesSquareIcon, Trash2Icon } from 'lucide-react'
import type { ReactNode } from 'react'
import { memo, useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import useSWR from 'swr'

import { fetchAgents } from '@/features/home/agentApi'
import { useSession } from '@/libs/better-auth/client'
import { markFirstConversion, trackAcquisitionEvent } from '@/libs/analytics/acquisition'

import {
  formatMessengerActiveAt,
  getMessengerPlatform,
  isMessengerProviderId,
  MESSENGER_DEFAULT_MODELS,
  MESSENGER_DEFAULT_PROVIDER,
  MESSENGER_PROVIDER_IDS,
} from './const'
import MessengerCommandList from './MessengerCommandList'
import { MessengerDetailShell } from './MessengerDetailShell'
import { MessengerModelSwitch } from './MessengerModelSwitch'
import QrCodeAuth from './QrCodeAuth'
import type { WechatAuthCredentials } from './QrCodeAuth'
import {
  bindWechat,
  fetchWechatStatus,
  retryFailedWechatEvents,
  unbindWechat,
  updateWechatConfiguration,
} from './wechatApi'
import type { WechatConfiguration, WechatProviderId, WechatStatus } from './wechatApi'

const STATUS_POLL_STARTING_MS = 1_000
const STATUS_POLL_MS = 8_000

const DISCONNECTED_STATUS: WechatStatus = {
  bound: false,
  connected: false,
  failedEventCount: 0,
  gatewaySupported: true,
  needsRebind: false,
  runtimeStatus: 'stopped',
}

function wechatBoundDescription(status: WechatStatus) {
  if (status.lastActiveAt) return `最近活动：${formatMessengerActiveAt(status.lastActiveAt)}`
  return '打开微信私聊机器人即可对话。'
}

function wechatConnectHint() {
  return {
    title: '使用微信扫码连接',
    description: '点击右上角「连接」，打开手机微信 → 右上角「+」→ 扫一扫，扫描二维码并确认授权。',
  }
}

function renderWechatStatusBanner(params: {
  bound: boolean
  message: { error: (content: string) => void; success: (content: string) => void }
  refreshStatus: () => Promise<WechatStatus>
  showConnect: boolean
  status: WechatStatus | null
}): ReactNode {
  const { bound, message, refreshStatus, showConnect, status } = params

  if (showConnect) {
    return <Alert showIcon type='info' {...wechatConnectHint()} />
  }

  if (status?.runtimeStatus === 'starting') {
    return (
      <Alert showIcon type='info' title='等待 Gateway' description='凭证已保存，Gateway 首次轮询成功后会显示在线。' />
    )
  }

  if (status?.runtimeStatus === 'reconnecting') {
    return (
      <Alert showIcon type='warning' title='Gateway 正在重连' description='微信轮询暂时失败，Gateway 正在自动重试。' />
    )
  }

  if (status?.runtimeStatus === 'degraded') {
    return (
      <Alert
        showIcon
        type='warning'
        title={`渠道异常${status.failedEventCount ? `，${status.failedEventCount} 条消息处理失败` : ''}`}
        description={status.lastError?.message || 'Gateway 仍在运行，但存在待重试或失败消息。'}
        action={
          status.failedEventCount ? (
            <Button
              size='small'
              onClick={() => {
                void retryFailedWechatEvents()
                  .then((count) => message.success(`已重新入队 ${count} 条消息`))
                  .then(refreshStatus)
                  .catch((error) => message.error(error instanceof Error ? error.message : '重试失败'))
              }}
            >
              重试失败消息
            </Button>
          ) : undefined
        }
      />
    )
  }

  if (status?.runtimeStatus === 'offline' && bound) {
    return (
      <Alert
        showIcon
        type='error'
        title='Gateway 离线'
        description='超过 90 秒未收到轮询心跳。请启动或检查微信 Gateway。'
      />
    )
  }

  if (bound && status) {
    return <Alert showIcon type='success' title='已连接微信' description={wechatBoundDescription(status)} />
  }

  return null
}

const MessengerWeChatPage = memo(() => {
  const { message } = useApp()
  const navigate = useNavigate()
  const platformMeta = getMessengerPlatform('wechat')!
  const { data: session } = useSession()
  const userId = session?.user?.id
  const [binding, setBinding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [agentId, setAgentId] = useState('agt_inbox')
  const [provider, setProvider] = useState<WechatProviderId>(MESSENGER_DEFAULT_PROVIDER)
  const [modelId, setModelId] = useState(MESSENGER_DEFAULT_MODELS.deepseek)

  const {
    data: status,
    error: statusError,
    isLoading: statusLoading,
    mutate: mutateStatus,
  } = useSWR<WechatStatus>(userId ? ['messenger-wechat-status', userId] : null, () => fetchWechatStatus(), {
    refreshInterval: (latestStatus) => {
      if (!latestStatus?.bound) return 0
      return latestStatus.runtimeStatus === 'starting' ? STATUS_POLL_STARTING_MS : STATUS_POLL_MS
    },
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
    if (status?.provider) setProvider(status.provider)
    if (status?.model) setModelId(status.model)
  }, [agentList, status])

  const refreshStatus = useCallback(async () => {
    if (!userId) throw new Error('登录状态尚未准备好')
    const nextStatus = await mutateStatus()
    if (!nextStatus) throw new Error('微信状态暂时不可用')
    return nextStatus
  }, [mutateStatus, userId])

  const handleAuthenticated = useCallback(
    async (credentials: WechatAuthCredentials) => {
      setBinding(true)
      try {
        await bindWechat({
          agentId,
          botId: credentials.botId,
          botToken: credentials.botToken,
          model: modelId,
          provider,
          userId: credentials.userId,
        })
        // 绑定只代表凭证已保存；必须等 Gateway 心跳后才能显示在线。
        const startingStatus: WechatStatus = {
          agentId,
          bound: true,
          connected: false,
          enabled: true,
          gatewaySupported: true,
          needsRebind: false,
          model: modelId,
          provider,
          runtimeStatus: 'starting',
        }
        await mutateStatus(startingStatus, { revalidate: true })
        trackAcquisitionEvent('channel_connected', {
          first: markFirstConversion('channel_connected'),
          platform: 'wechat',
        })
        message.success('凭证已保存，正在等待 Gateway')
      } catch (error) {
        message.error(error instanceof Error ? error.message : '绑定失败')
      } finally {
        setBinding(false)
      }
    },
    [agentId, message, modelId, mutateStatus, provider]
  )

  const saveConfiguration = useCallback(
    async (next: WechatConfiguration, previous: WechatConfiguration) => {
      if (!status?.bound || status.needsRebind || status.enabled === false) return
      setSaving(true)
      try {
        await updateWechatConfiguration(next)
        message.success('已更新微信渠道配置，新消息将使用全新对话')
      } catch (error) {
        setAgentId(previous.agentId)
        setProvider(previous.provider)
        setModelId(previous.model)
        message.error(error instanceof Error ? error.message : '更新失败')
        setSaving(false)
        return
      }
      try {
        await refreshStatus()
      } catch {
        message.warning('配置已保存，状态将在稍后自动刷新')
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

  const handleDisconnect = useCallback(() => {
    confirmModal({
      content: '断开后需重新扫码才能在微信中对话。',
      okText: '断开',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await unbindWechat()
        // 先乐观更新，避免仍显示「已连接」
        await mutateStatus(DISCONNECTED_STATUS, { revalidate: false })
        message.success('已断开微信')
        try {
          await refreshStatus()
        } catch {
          /* 已乐观断开 */
        }
      },
      title: '断开微信连接？',
    })
  }, [message, mutateStatus, refreshStatus])

  if (loading) {
    return (
      <MessengerDetailShell platform='wechat' platformMeta={platformMeta}>
        <Flex className='flex-col-center min-h-[160px]'>
          <Spin />
        </Flex>
      </MessengerDetailShell>
    )
  }

  const bound = Boolean(status?.bound)
  const gatewaySupported = status?.gatewaySupported !== false
  const needsRebind = Boolean(status?.needsRebind) || (bound && status?.enabled === false)
  const showConnect = !bound || needsRebind
  const controlsDisabled = binding || saving
  const allowedProviders = MESSENGER_PROVIDER_IDS.filter(
    (id) => status?.providerAvailability?.[id]?.available !== false
  )

  // Gateway 不可用（Vercel / 未开启内置进程）时不展示连接配置与操作按钮。
  const headerAction = gatewaySupported ? (
    <Flex className='flex-row items-center gap-2'>
      {isDev ? (
        <Button icon={<MessagesSquareIcon size={16} />} onClick={() => navigate('/dev/wechat-conversation')}>
          对话监控
        </Button>
      ) : null}
      {showConnect ? (
        <QrCodeAuth disabled={binding} onAuthenticated={(c) => void handleAuthenticated(c)} />
      ) : (
        <Button danger disabled={binding} icon={<Trash2Icon size={16} />} onClick={handleDisconnect}>
          断开
        </Button>
      )}
    </Flex>
  ) : undefined

  return (
    <MessengerDetailShell headerAction={headerAction} platform='wechat' platformMeta={platformMeta}>
      {!gatewaySupported ? (
        <Alert
          showIcon
          type='info'
          title='当前部署不支持微信 Gateway'
          description='Vercel 无法运行常驻轮询进程。请使用开启内置 Gateway 的本地环境或 Docker Compose 部署。'
        />
      ) : (
        <Flex className='flex-col gap-2'>
          <Text strong style={{ fontSize: 15 }}>
            连接微信
          </Text>

          <Flex className='flex-col gap-2'>
            <Text type='secondary' style={{ fontSize: 13 }}>
              绑定助手
            </Text>
            <Select
              disabled={controlsDisabled}
              options={agents}
              style={{ maxWidth: 360 }}
              value={agentId}
              onChange={(v) => void handleAgentChange(v)}
            />
          </Flex>

          <MessengerModelSwitch
            allowedProviders={allowedProviders}
            disabled={controlsDisabled}
            modelId={modelId}
            provider={provider}
            onSelect={handleModelSelect}
          />

          {needsRebind && (
            <Alert showIcon type='warning' title='微信会话已过期或需要重新连接' description='请再次扫码绑定。' />
          )}

          {renderWechatStatusBanner({ bound, message, refreshStatus, showConnect, status: status ?? null })}
        </Flex>
      )}

      <MessengerCommandList />
    </MessengerDetailShell>
  )
})

MessengerWeChatPage.displayName = 'MessengerWeChatPage'

export default MessengerWeChatPage
