'use client'

import { getErrorMessage } from '@pure/utils/error'

import { confirmModal, toast, Spin } from '@lobehub/ui'
import { ActionIcon, Button, Text, Flex } from '@pure/ui'
import type { AgentListItem } from '@/const/home/agents'
import { isAdminRole } from '@/const/auth'
import { FileText, MessagesSquareIcon, Trash2Icon } from 'lucide-react'
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
} from './const'
import MessengerAgentSelect from './MessengerAgentSelect'
import { ChannelGatewayLogsModal } from './ChannelGatewayLogsModal'
import { ChannelGatewayStatusIndicator } from './ChannelGatewayStatusIndicator'
import type { ChannelGatewayStatus } from './ChannelGatewayStatusIndicator'
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

function getWechatGatewayStatus(params: {
  bound: boolean
  error: unknown
  gatewaySupported: boolean
  needsRebind: boolean
  status: WechatStatus | null | undefined
}): ChannelGatewayStatus {
  const { bound, error, gatewaySupported, needsRebind, status } = params

  if (error) {
    return {
      description: getErrorMessage(error, '无法读取微信网关状态。'),
      title: '状态读取失败',
      type: 'error',
    }
  }

  if (!gatewaySupported) {
    return {
      description: '当前部署不支持常驻微信 Gateway。',
      title: 'Gateway 不可用',
      type: 'warning',
    }
  }

  if (!bound) {
    return { description: '点击右上角「连接」并使用微信扫码绑定。', title: '尚未连接微信', type: 'info' }
  }

  if (needsRebind || status?.runtimeStatus === 'needs_rebind') {
    return { description: '微信会话已过期，请重新扫码连接。', title: '需要重新连接微信', type: 'warning' }
  }

  const runtimeStatus = status?.runtimeStatus
  const lastError = status?.lastError?.message

  if (runtimeStatus === 'online') {
    return {
      description: status ? wechatBoundDescription(status) : '微信 Gateway 已连接。',
      title: '微信 Gateway 正常',
      type: 'success',
    }
  }

  if (runtimeStatus === 'starting') {
    return { description: '凭证已保存，等待 Gateway 首次轮询成功。', title: 'Gateway 启动中', type: 'info' }
  }

  if (runtimeStatus === 'degraded' || runtimeStatus === 'reconnecting') {
    const failedCount = status?.failedEventCount ?? 0
    const failedMessage = failedCount ? `有 ${failedCount} 条消息处理失败。` : ''
    return {
      description: [failedMessage, lastError || 'Gateway 正在自动恢复。'].filter(Boolean).join(' '),
      title: runtimeStatus === 'reconnecting' ? 'Gateway 正在重连' : '微信渠道需要关注',
      type: 'warning',
    }
  }

  if (runtimeStatus === 'offline' || runtimeStatus === 'stopped') {
    return {
      description: lastError || '超过 90 秒未收到 Gateway 心跳，请检查服务状态。',
      title: '微信 Gateway 离线',
      type: 'error',
    }
  }

  return status?.connected
    ? { description: '微信渠道已连接。', title: '微信连接正常', type: 'success' }
    : { description: lastError || '请检查连接配置或查看诊断日志。', title: '微信连接异常', type: 'warning' }
}

const MessengerWeChatPage = memo(() => {
  const navigate = useNavigate()
  const platformMeta = getMessengerPlatform('wechat')!
  const { data: session } = useSession()
  const userId = session?.user?.id
  const [binding, setBinding] = useState(false)
  const [retryingFailedEvents, setRetryingFailedEvents] = useState(false)
  const [saving, setSaving] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
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
  const agents = agentList ?? []
  const loading = !userId || statusLoading || agentsLoading

  useEffect(() => {
    const error = statusError ?? agentsError
    if (!error || status || agentList?.length) return
    toast.error(getErrorMessage(error, '加载失败'))
  }, [agentList?.length, agentsError, status, statusError])

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

  const handleRetryFailedEvents = useCallback(async () => {
    setRetryingFailedEvents(true)
    try {
      const count = await retryFailedWechatEvents()
      toast.success(`已重新入队 ${count} 条消息`)
      await refreshStatus()
    } catch (error) {
      toast.error(getErrorMessage(error, '重试失败'))
    } finally {
      setRetryingFailedEvents(false)
    }
  }, [refreshStatus])

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
        toast.success('凭证已保存，正在等待 Gateway')
      } catch (error) {
        toast.error(getErrorMessage(error, '绑定失败'))
      } finally {
        setBinding(false)
      }
    },
    [agentId, modelId, mutateStatus, provider]
  )

  const saveConfiguration = useCallback(
    async (next: WechatConfiguration, previous: WechatConfiguration) => {
      if (!status?.bound || status.needsRebind || status.enabled === false) return
      setSaving(true)
      try {
        await updateWechatConfiguration(next)
        toast.success('已更新微信渠道配置，新消息将使用全新对话')
      } catch (error) {
        setAgentId(previous.agentId)
        setProvider(previous.provider)
        setModelId(previous.model)
        toast.error(getErrorMessage(error, '更新失败'))
        setSaving(false)
        return
      }
      try {
        await refreshStatus()
      } catch {
        toast.warning('配置已保存，状态将在稍后自动刷新')
      } finally {
        setSaving(false)
      }
    },
    [refreshStatus, status]
  )

  const handleAgentChange = useCallback(
    (value: string) => {
      const previous = { agentId, model: modelId, provider }
      setAgentId(value)
      saveConfiguration({ ...previous, agentId: value }, previous)
    },
    [agentId, modelId, provider, saveConfiguration]
  )

  const handleModelSelect = useCallback(
    (nextProvider: string, nextModel: string) => {
      if (!isMessengerProviderId(nextProvider)) return
      const previous = { agentId, model: modelId, provider }
      setProvider(nextProvider)
      setModelId(nextModel)
      saveConfiguration({ agentId, model: nextModel, provider: nextProvider }, previous)
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
        toast.success('已断开微信')
        try {
          await refreshStatus()
        } catch {
          /* 已乐观断开 */
        }
      },
      title: '断开微信连接？',
    })
  }, [mutateStatus, refreshStatus])

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
  const gatewayStatus = getWechatGatewayStatus({
    bound,
    error: statusError,
    gatewaySupported,
    needsRebind,
    status,
  })

  // Gateway 不可用（Vercel / 未开启内置进程）时不展示连接配置与操作按钮。
  const headerAction = gatewaySupported ? (
    <Flex className='items-center gap-2'>
      {isAdminRole(session?.user?.role) ? (
        <Button icon={<MessagesSquareIcon size={16} />} onClick={() => navigate('/settings/wechat-conversation')}>
          对话监控
        </Button>
      ) : null}
      {showConnect ? (
        <QrCodeAuth disabled={binding} onAuthenticated={(c) => handleAuthenticated(c)} />
      ) : (
        <Button danger disabled={binding} icon={<Trash2Icon size={16} />} onClick={handleDisconnect}>
          断开
        </Button>
      )}
    </Flex>
  ) : undefined

  return (
    <MessengerDetailShell headerAction={headerAction} platform='wechat' platformMeta={platformMeta}>
      <Flex className='items-center gap-2'>
        <Text className='text-[15px]' strong>
          连接微信
        </Text>
        <ActionIcon
          icon={FileText}
          size='small'
          title='查看微信网关诊断日志'
          aria-label='查看微信网关诊断日志'
          onClick={() => setLogsOpen(true)}
        />
        <ChannelGatewayStatusIndicator {...gatewayStatus} />
        {status?.runtimeStatus === 'degraded' && status.failedEventCount ? (
          <Button
            disabled={retryingFailedEvents}
            loading={retryingFailedEvents}
            size='small'
            onClick={handleRetryFailedEvents}
          >
            重试 {status.failedEventCount} 条失败消息
          </Button>
        ) : null}
      </Flex>
      {gatewaySupported ? (
        <Flex className='flex-col gap-2'>
          <Flex className='flex-col gap-2'>
            <Text className='text-[13px]' type='secondary'>
              绑定助手
            </Text>
            <MessengerAgentSelect
              agents={agents}
              disabled={controlsDisabled}
              value={agentId}
              onChange={handleAgentChange}
            />
          </Flex>

          <MessengerModelSwitch
            disabled={controlsDisabled}
            modelId={modelId}
            provider={provider}
            onSelect={handleModelSelect}
          />
        </Flex>
      ) : null}

      <MessengerCommandList platform='wechat' />
      {logsOpen ? (
        <ChannelGatewayLogsModal
          userId={userId}
          platform='wechat'
          bound={bound}
          gatewaySupported={gatewaySupported}
          onClose={() => setLogsOpen(false)}
        />
      ) : null}
    </MessengerDetailShell>
  )
})

MessengerWeChatPage.displayName = 'MessengerWeChatPage'

export default MessengerWeChatPage
