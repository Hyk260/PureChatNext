'use client'

import { Button, Flexbox, Text } from '@lobehub/ui'
import { Alert, App, Input, Radio, Select, Spin } from 'antd'
import { Trash2Icon } from 'lucide-react'
import { memo, useCallback, useEffect, useState } from 'react'

import { fetchAgents } from '@/features/home/agentApi'

import { getMessengerPlatform } from './const'
import MessengerCommandList from './MessengerCommandList'
import { MessengerDetailShell } from './MessengerDetailShell'
import {
  bindQQ,
  fetchQQStatus,
  type QQConnectionMode,
  type QQStatus,
  unbindQQ,
  updateQQAgent,
} from './qqApi'

function formatActiveAt(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    year: 'numeric',
  })
}

const DISCONNECTED_STATUS: QQStatus = {
  connected: false,
}

const MessengerQQPage = memo(() => {
  const { message, modal } = App.useApp()
  const platformMeta = getMessengerPlatform('qq')!
  const [loading, setLoading] = useState(true)
  const [binding, setBinding] = useState(false)
  const [status, setStatus] = useState<QQStatus | null>(null)
  const [agents, setAgents] = useState<Array<{ label: string; value: string }>>([])
  const [agentId, setAgentId] = useState('agt_inbox')
  const [appId, setAppId] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [connectionMode, setConnectionMode] = useState<QQConnectionMode>('websocket')

  const refreshStatus = useCallback(async () => {
    const st = await fetchQQStatus()
    setStatus(st)
    if (st.agentId) setAgentId(st.agentId)
    if (st.appId) setAppId(st.appId)
    if (st.connectionMode) setConnectionMode(st.connectionMode)
    return st
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [st, agentList] = await Promise.all([fetchQQStatus(), fetchAgents()])
      setStatus(st)
      setAgents(agentList.map((a) => ({ label: a.title, value: a.id })))
      if (st.agentId) setAgentId(st.agentId)
      else if (agentList[0]) setAgentId(agentList[0].id)
      if (st.appId) setAppId(st.appId)
      if (st.connectionMode) setConnectionMode(st.connectionMode)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void reload()
  }, [reload])

  const handleBind = useCallback(async () => {
    if (!appId.trim() || !appSecret.trim()) {
      message.warning('请填写 App ID 与 App Secret')
      return
    }
    setBinding(true)
    try {
      await bindQQ({
        agentId,
        appId: appId.trim(),
        appSecret: appSecret.trim(),
        connectionMode,
      })
      setAppSecret('')
      message.success('QQ 已连接')
      await refreshStatus()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '绑定失败')
    } finally {
      setBinding(false)
    }
  }, [agentId, appId, appSecret, connectionMode, message, refreshStatus])

  const handleAgentChange = useCallback(
    async (value: string) => {
      setAgentId(value)
      if (!status?.connected || status.enabled === false) return
      try {
        await updateQQAgent(value)
        message.success('已更新绑定助手')
        await refreshStatus()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '更新失败')
      }
    },
    [message, refreshStatus, status],
  )

  const handleDisconnect = useCallback(() => {
    modal.confirm({
      centered: true,
      content: '断开后需重新填写 App ID / Secret 才能在 QQ 中对话。',
      okText: '断开',
      okType: 'danger',
      onOk: async () => {
        await unbindQQ()
        setStatus(DISCONNECTED_STATUS)
        setAppSecret('')
        message.success('已断开 QQ')
        try {
          await refreshStatus()
        } catch {
          /* 已乐观断开 */
        }
      },
      title: '断开 QQ 连接？',
    })
  }, [message, modal, refreshStatus])

  if (loading) {
    return (
      <MessengerDetailShell platform="qq" platformMeta={platformMeta}>
        <Flexbox align="center" justify="center" style={{ minHeight: 160 }}>
          <Spin />
        </Flexbox>
      </MessengerDetailShell>
    )
  }

  const connected = Boolean(status?.connected)
  const showConnect = !connected

  const headerAction = showConnect ? (
    <Button loading={binding} type="primary" onClick={() => void handleBind()}>
      连接
    </Button>
  ) : (
    <Button danger disabled={binding} icon={Trash2Icon} onClick={handleDisconnect}>
      断开
    </Button>
  )

  return (
    <MessengerDetailShell headerAction={headerAction} platform="qq" platformMeta={platformMeta}>
      <Flexbox gap={12}>
        <Text strong style={{ fontSize: 15 }}>
          连接 QQ
        </Text>

        <Flexbox gap={8}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            绑定助手
          </Text>
          <Select
            options={agents}
            style={{ maxWidth: 360 }}
            value={agentId}
            onChange={(v) => void handleAgentChange(v)}
          />
        </Flexbox>

        {showConnect ? (
          <>
            <Flexbox gap={8}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                App ID
              </Text>
              <Input
                placeholder="来自 q.qq.com 开发设置"
                style={{ maxWidth: 420 }}
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
              />
            </Flexbox>
            <Flexbox gap={8}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                App Secret
              </Text>
              <Input.Password
                placeholder="请妥善保管，不会回显已保存的密钥"
                style={{ maxWidth: 420 }}
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
              />
            </Flexbox>
            <Flexbox gap={8}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                连接模式
              </Text>
              <Radio.Group
                value={connectionMode}
                onChange={(e) => setConnectionMode(e.target.value as QQConnectionMode)}
              >
                <Radio.Button value="websocket">WebSocket（推荐）</Radio.Button>
                <Radio.Button value="webhook">Webhook</Radio.Button>
              </Radio.Group>
            </Flexbox>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {connectionMode === 'websocket'
                ? '保存后请运行 pnpm qq:gateway 维护 WebSocket 连接。'
                : '保存后将显示回调地址，请粘贴到 QQ 开放平台「回调配置」。'}
            </Text>
          </>
        ) : (
          <>
            <Alert
              showIcon
              type="success"
              message="已连接 QQ"
              description={
                status?.lastActiveAt
                  ? `最近活动：${formatActiveAt(status.lastActiveAt)} · 模式：${status.connectionMode ?? 'websocket'}`
                  : `模式：${status.connectionMode ?? 'websocket'}。在 QQ 私聊或群内 @ 机器人即可对话。`
              }
            />
            {status?.connectionMode === 'webhook' && status.webhookUrl && (
              <Alert
                showIcon
                type="info"
                message="Webhook 回调地址"
                description={
                  <Text copyable style={{ fontSize: 13 }}>
                    {status.webhookUrl}
                  </Text>
                }
              />
            )}
            {status?.connectionMode === 'websocket' && (
              <Text type="secondary" style={{ fontSize: 13 }}>
                自托管请保持运行：pnpm qq:gateway
              </Text>
            )}
          </>
        )}
      </Flexbox>

      <MessengerCommandList />
    </MessengerDetailShell>
  )
})

MessengerQQPage.displayName = 'MessengerQQPage'

export default MessengerQQPage
