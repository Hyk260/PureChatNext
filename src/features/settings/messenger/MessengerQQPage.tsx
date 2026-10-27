'use client'

import { getErrorMessage } from '@pure/utils/error'

import { confirmModal, toast, Spin } from '@lobehub/ui'
import { ActionIcon, Button, Text, Flex } from '@pure/ui'
import { copyToClipboard } from '@pure/utils/client'
import type { AgentListItem } from '@/const/home/agents'
import { Copy, FileText, MessagesSquareIcon, Settings2Icon, Trash2Icon } from 'lucide-react'
import { memo, useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import useSWR from 'swr'

import { isAdminRole } from '@/const/auth'
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
import MessengerAgentSelect from './MessengerAgentSelect'
import { ChannelGatewayLogsModal } from './ChannelGatewayLogsModal'
import { ChannelGatewayStatusIndicator } from './ChannelGatewayStatusIndicator'
import type { ChannelGatewayStatus } from './ChannelGatewayStatusIndicator'
import MessengerCommandList from './MessengerCommandList'
import { MessengerDetailShell } from './MessengerDetailShell'
import { MessengerModelSwitch } from './MessengerModelSwitch'
import QQAdvancedSettingsModal from './QQAdvancedSettingsModal'
import { QQConnectButton } from './QQConnectModal'
import { fetchQQStatus, unbindQQ, updateQQConfiguration } from './qqApi'
import type { QQProviderId, QQStatus } from './qqApi'

function getQqGatewayStatus(params: {
  error: unknown
  gatewaySupported: boolean
  showConnect: boolean
  status: QQStatus | null | undefined
}): ChannelGatewayStatus {
  const { error, gatewaySupported, showConnect, status } = params

  if (error) {
    return {
      description: getErrorMessage(error, '无法读取 QQ 网关状态。'),
      title: '状态读取失败',
      type: 'error',
    }
  }

  if (showConnect) {
    return {
      description: gatewaySupported
        ? '点击右上角「连接」，使用手机 QQ 扫码或选择其他连接方式。'
        : '当前部署仅支持 URL 回调；点击右上角「连接」使用 App ID 和 Secret 配置。',
      title: '尚未连接 QQ',
      type: 'info',
    }
  }

  if (status?.connectionMode === 'webhook' && status.enabled !== false) {
    return {
      description: 'Webhook 回调已启用，无需常驻 Gateway。',
      title: 'QQ Webhook 正常',
      type: 'success',
    }
  }

  if (!gatewaySupported) {
    return {
      description: '当前部署不支持 QQ WebSocket Gateway。',
      title: 'Gateway 不可用',
      type: 'warning',
    }
  }

  const runtimeStatus = status?.runtimeStatus
  const lastError = status?.lastError?.message

  if (runtimeStatus === 'online') {
    return {
      description: status?.lastHeartbeatAt
        ? `最近心跳：${formatMessengerActiveAt(status.lastHeartbeatAt)}`
        : 'Gateway 已建立 WebSocket 连接。',
      title: 'QQ Gateway 正常',
      type: 'success',
    }
  }

  if (runtimeStatus === 'starting') {
    return { description: '凭证已保存，Gateway 正在建立连接。', title: 'Gateway 启动中', type: 'info' }
  }

  if (runtimeStatus === 'reconnecting') {
    return {
      description: lastError || 'Gateway 正在恢复连接，请稍后查看诊断日志。',
      title: 'Gateway 正在重连',
      type: 'warning',
    }
  }

  if (runtimeStatus === 'degraded') {
    return {
      description: lastError || 'Gateway 仍在运行，但当前处于异常状态。',
      title: 'QQ Gateway 异常',
      type: 'warning',
    }
  }

  if (runtimeStatus === 'needs_rebind') {
    return { description: lastError || '请重新连接 QQ。', title: 'QQ 需要重新连接', type: 'warning' }
  }

  if (runtimeStatus === 'offline' || runtimeStatus === 'stopped') {
    return {
      description: lastError || 'Gateway 尚未连接或已停止运行。',
      title: 'QQ Gateway 离线',
      type: 'error',
    }
  }

  return status?.connected
    ? { description: 'QQ 渠道已连接。', title: 'QQ 连接正常', type: 'success' }
    : { description: lastError || '请检查连接配置或查看诊断日志。', title: 'QQ 连接异常', type: 'warning' }
}

const DISCONNECTED_STATUS: QQStatus = {
  connected: false,
  gatewaySupported: false,
}

const MessengerQQPage = memo(() => {
  const navigate = useNavigate()
  const platformMeta = getMessengerPlatform('qq')!
  const { data: session } = useSession()
  const userId = session?.user?.id
  const [binding, setBinding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [agentId, setAgentId] = useState('agt_inbox')
  const [provider, setProvider] = useState<QQProviderId>(QQ_DEFAULT_PROVIDER)
  const [modelId, setModelId] = useState(QQ_DEFAULT_MODEL)

  const {
    data: status,
    error: statusError,
    isLoading: statusLoading,
    mutate: mutateStatus,
  } = useSWR<QQStatus>(userId ? ['messenger-qq-status', userId] : null, fetchQQStatus, {
    revalidateOnFocus: false,
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
        toast.success('已更新 QQ 渠道配置')
        await refreshStatus()
      } catch (error) {
        setAgentId(previous.agentId)
        setProvider(previous.provider)
        setModelId(previous.model)
        toast.error(getErrorMessage(error, '更新失败'))
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

  const handleConnected = useCallback(async () => {
    setBinding(true)
    try {
      toast.success('QQ 凭证已保存，正在建立连接')
      await refreshStatus()
      trackAcquisitionEvent('channel_connected', {
        first: markFirstConversion('channel_connected'),
        platform: 'qq',
      })
    } finally {
      setBinding(false)
    }
  }, [refreshStatus])

  const handleDisconnect = useCallback(() => {
    confirmModal({
      content: '断开后需重新扫码才能在 QQ 中对话。',
      okText: '断开',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await unbindQQ()
        await mutateStatus(DISCONNECTED_STATUS, { revalidate: false })
        toast.success('已断开 QQ')
        try {
          await refreshStatus()
        } catch {
          /* 已乐观断开 */
        }
      },
      title: '断开 QQ 连接？',
    })
  }, [mutateStatus, refreshStatus])

  if (loading) {
    return (
      <MessengerDetailShell platform='qq' platformMeta={platformMeta}>
        <Flex className='flex-col-center min-h-[160px]'>
          <Spin />
        </Flex>
      </MessengerDetailShell>
    )
  }

  const gatewaySupported = status?.gatewaySupported !== false
  const showConnect = !status?.applicationId
  const webhookUrl = status?.connectionMode === 'webhook' ? status.webhookUrl : undefined
  const controlsDisabled = binding || saving
  const gatewayStatus = getQqGatewayStatus({
    error: statusError,
    gatewaySupported,
    showConnect,
    status,
  })

  const headerAction = (
    <Flex className='items-center gap-2'>
      <Button
        disabled={showConnect}
        icon={<Settings2Icon size={16} />}
        title={showConnect ? '请先连接 QQ' : undefined}
        onClick={() => setAdvancedOpen(true)}
      >
        高级设置
      </Button>
      {isAdminRole(session?.user?.role) ? (
        <Button icon={<MessagesSquareIcon size={16} />} onClick={() => navigate('/settings/qq-conversation')}>
          对话监控
        </Button>
      ) : null}
      {showConnect ? (
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
      )}
    </Flex>
  )

  return (
    <MessengerDetailShell headerAction={headerAction} platform='qq' platformMeta={platformMeta}>
      <Flex className='flex-col gap-3'>
        <Flex className='items-center gap-2'>
          <Text className='text-[15px]' strong>
            连接 QQ
          </Text>
          <ActionIcon
            icon={FileText}
            size='small'
            title='查看 QQ 网关诊断日志'
            aria-label='查看 QQ 网关诊断日志'
            onClick={() => setLogsOpen(true)}
          />
          <ChannelGatewayStatusIndicator {...gatewayStatus} />
        </Flex>

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
        {webhookUrl ? (
          <Flex className='items-center gap-2 rounded-lg bg-secondary px-3 py-2'>
            <Text className='shrink-0 text-[13px]' type='secondary'>
              Webhook 回调地址
            </Text>
            <Text className='min-w-0 flex-1 truncate text-[13px]' title={webhookUrl}>
              {webhookUrl}
            </Text>
            <ActionIcon
              icon={Copy}
              size='small'
              title='复制 Webhook 回调地址'
              onClick={async () => {
                await copyToClipboard(webhookUrl)
                toast.success('已复制 Webhook 回调地址')
              }}
            />
          </Flex>
        ) : null}
      </Flex>

      <MessengerCommandList platform='qq' />
      {logsOpen ? (
        <ChannelGatewayLogsModal
          userId={userId}
          platform='qq'
          bound={!showConnect}
          gatewaySupported={gatewaySupported}
          connectionMode={status?.connectionMode}
          onClose={() => setLogsOpen(false)}
        />
      ) : null}

      {advancedOpen ? (
        <QQAdvancedSettingsModal
          initialSettings={status?.settings}
          open
          onClose={() => setAdvancedOpen(false)}
          onSaved={(settings) => {
            mutateStatus((current) => (current ? { ...current, settings } : current), { revalidate: false })
          }}
        />
      ) : null}
    </MessengerDetailShell>
  )
})

MessengerQQPage.displayName = 'MessengerQQPage'

export default MessengerQQPage
