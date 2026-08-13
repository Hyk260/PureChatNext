'use client'

import { Alert, Select, Spin } from 'antd'
import { Button, confirmModal, Text, Flexbox } from '@pure/ui'
import { formatDateTime } from '@pure/utils/client'
import { getProviderChatModels, PURECHAT_DEFAULT_MODEL } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'
import { useApp } from '@/components/AntdStaticMethods'
import { isDev } from '@/libs/constants'
import { MessagesSquareIcon, Trash2Icon } from 'lucide-react'
import { memo, useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { fetchAgents } from '@/features/home/agentApi'

import { getMessengerPlatform } from './const'
import MessengerCommandList from './MessengerCommandList'
import { MessengerDetailShell } from './MessengerDetailShell'
import QrCodeAuth from './QrCodeAuth'
import type { WechatAuthCredentials } from './QrCodeAuth'
import { bindWechat, fetchWechatStatus, retryFailedWechatEvents, unbindWechat, updateWechatConfiguration } from './wechatApi'
import type { WechatConfiguration, WechatProviderId, WechatStatus } from './wechatApi'

const STATUS_POLL_MS = 8_000
const DEFAULT_MODELS: Record<WechatProviderId, string> = {
  deepseek: 'deepseek-v4-flash',
  openai: 'gpt-5.4-mini',
  purechat: PURECHAT_DEFAULT_MODEL,
}
const PROVIDERS: Array<{ label: string; value: WechatProviderId }> = [
  { label: 'PureChat', value: 'purechat' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'DeepSeek', value: 'deepseek' },
]

const formatActiveAt = (value: string) => formatDateTime(value, { hour12: false, second: '2-digit' })

const DISCONNECTED_STATUS: WechatStatus = {
  bound: false,
  connected: false,
  failedEventCount: 0,
  gatewaySupported: true,
  needsRebind: false,
  runtimeStatus: 'stopped',
}

const MessengerWeChatPage = memo(() => {
  const { message } = useApp()
  const navigate = useNavigate()
  const platformMeta = getMessengerPlatform('wechat')!
  const [loading, setLoading] = useState(true)
  const [binding, setBinding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<WechatStatus | null>(null)
  const [agents, setAgents] = useState<Array<{ label: string; value: string }>>([])
  const [agentId, setAgentId] = useState('agt_inbox')
  const [provider, setProvider] = useState<WechatProviderId>('deepseek')
  const [modelId, setModelId] = useState(DEFAULT_MODELS.deepseek)

  const refreshStatus = useCallback(async () => {
    const st = await fetchWechatStatus()
    setStatus(st)
    if (st.agentId) setAgentId(st.agentId)
    if (st.provider) setProvider(st.provider)
    if (st.model) setModelId(st.model)
    return st
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [st, agentList] = await Promise.all([fetchWechatStatus(), fetchAgents()])
      setStatus(st)
      setAgents(agentList.map((a) => ({ label: a.title, value: a.id })))
      if (st.agentId) setAgentId(st.agentId)
      else if (agentList[0]) setAgentId(agentList[0].id)
      if (st.provider) setProvider(st.provider)
      if (st.model) setModelId(st.model)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void reload()
  }, [reload])

  // 已绑定后持续轮询真实心跳，Gateway 停止时不能继续显示已连接。
  useEffect(() => {
    if (loading || !status?.bound) return

    const tick = () => {
      void refreshStatus().catch(() => {
        /* 静默：轮询失败不打扰 */
      })
    }

    const id = window.setInterval(tick, STATUS_POLL_MS)
    return () => window.clearInterval(id)
  }, [loading, refreshStatus, status?.bound])

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
        setStatus({
          agentId,
          bound: true,
          connected: false,
          enabled: true,
          gatewaySupported: true,
          needsRebind: false,
          model: modelId,
          provider,
          runtimeStatus: 'starting',
        })
        message.success('凭证已保存，正在等待 Gateway')
        await refreshStatus()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '绑定失败')
      } finally {
        setBinding(false)
      }
    },
    [agentId, message, modelId, provider, refreshStatus]
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

  const handleAgentChange = useCallback((value: string) => {
    const previous = { agentId, model: modelId, provider }
    setAgentId(value)
    void saveConfiguration({ ...previous, agentId: value }, previous)
  }, [agentId, modelId, provider, saveConfiguration])

  const handleProviderChange = useCallback((value: WechatProviderId) => {
    const previous = { agentId, model: modelId, provider }
    const next = { agentId, model: DEFAULT_MODELS[value], provider: value }
    setProvider(value)
    setModelId(next.model)
    void saveConfiguration(next, previous)
  }, [agentId, modelId, provider, saveConfiguration])

  const handleModelChange = useCallback((value: string) => {
    const previous = { agentId, model: modelId, provider }
    setModelId(value)
    void saveConfiguration({ ...previous, model: value }, previous)
  }, [agentId, modelId, provider, saveConfiguration])

  const handleDisconnect = useCallback(() => {
    confirmModal({
      content: '断开后需重新扫码才能在微信中对话。',
      okText: '断开',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await unbindWechat()
        // 先乐观更新，避免仍显示「已连接」
        setStatus(DISCONNECTED_STATUS)
        message.success('已断开微信')
        try {
          await refreshStatus()
        } catch {
          /* 已乐观断开 */
        }
      },
      title: '断开微信连接？',
    })
  }, [message, refreshStatus])

  if (loading) {
    return (
      <MessengerDetailShell platform='wechat' platformMeta={platformMeta}>
        <Flexbox align='center' justify='center' style={{ minHeight: 160 }}>
          <Spin />
        </Flexbox>
      </MessengerDetailShell>
    )
  }

  const bound = Boolean(status?.bound)
  const gatewaySupported = status?.gatewaySupported !== false
  const needsRebind = Boolean(status?.needsRebind) || (bound && status?.enabled === false)
  const showConnect = !bound || needsRebind
  const controlsDisabled = binding || saving
  const modelOptions = getProviderChatModels(provider as ModelProviderId)
    .filter((model) => model.enabled !== false)
    .map((model) => ({ label: model.displayName, value: model.id }))
  const providerOptions = PROVIDERS.map((item) => {
    const availability = status?.providerAvailability?.[item.value]
    return {
      ...item,
      disabled: availability?.available === false,
      label: availability?.available === false ? `${item.label}（${availability.reason || '服务端不可用'}）` : item.label,
    }
  })

  // Gateway 不可用（Vercel / 未开启内置进程）时不展示连接配置与操作按钮。
  const headerAction = gatewaySupported ? (
    <Flexbox horizontal align='center' gap={8}>
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
    </Flexbox>
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
        <Flexbox gap={8}>
          <Text strong style={{ fontSize: 15 }}>
            连接微信
          </Text>

          <Flexbox gap={8}>
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
          </Flexbox>

          <Flexbox gap={8}>
            <Text type='secondary' style={{ fontSize: 13 }}>服务商</Text>
            <Select disabled={controlsDisabled} options={providerOptions} style={{ maxWidth: 360 }} value={provider} onChange={handleProviderChange} />
          </Flexbox>

          <Flexbox gap={8}>
            <Text type='secondary' style={{ fontSize: 13 }}>模型</Text>
            <Select disabled={controlsDisabled} options={modelOptions} style={{ maxWidth: 360 }} value={modelId} onChange={handleModelChange} />
          </Flexbox>

          {needsRebind && (
            <Alert showIcon type='warning' title='微信会话已过期或需要重新连接' description='请再次扫码绑定。' />
          )}

          {showConnect ? (
            <Text type='secondary' style={{ fontSize: 13 }}>
              打开手机微信 → 右上角「+」→ 扫一扫，扫描二维码并确认。
            </Text>
          ) : status?.runtimeStatus === 'starting' ? (
            <Alert showIcon type='info' title='等待 Gateway' description='凭证已保存，Gateway 首次轮询成功后会显示在线。' />
          ) : status?.runtimeStatus === 'degraded' ? (
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
          ) : status?.runtimeStatus === 'offline' && bound ? (
            <Alert
              showIcon
              type='error'
              title='Gateway 离线'
              description='超过 90 秒未收到轮询心跳。请启动或检查微信 Gateway。'
            />
          ) : bound ? (
            <Alert
              showIcon
              type='success'
              title='已连接微信'
              description={
                status?.lastActiveAt ? `最近活动：${formatActiveAt(status.lastActiveAt)}` : '打开微信私聊机器人即可对话。'
              }
            />
          ) : null}
        </Flexbox>
      )}

      <MessengerCommandList />
    </MessengerDetailShell>
  )
})

MessengerWeChatPage.displayName = 'MessengerWeChatPage'

export default MessengerWeChatPage
