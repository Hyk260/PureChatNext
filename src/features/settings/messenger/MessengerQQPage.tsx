'use client'

import { Alert, Select, Spin } from 'antd'
import { Button, confirmModal, Text, copyToClipboard, Flexbox } from '@pure/ui'
import { formatDateTime } from '@pure/utils/client'
import { useApp } from '@/components/AntdStaticMethods'
import { Trash2Icon } from 'lucide-react'
import { memo, useCallback, useEffect, useState } from 'react'

import { fetchAgents } from '@/features/home/agentApi'

import { getMessengerPlatform } from './const'
import MessengerCommandList from './MessengerCommandList'
import { MessengerDetailShell } from './MessengerDetailShell'
import { QQConnectButton } from './QQConnectModal'
import { fetchQQStatus, unbindQQ, updateQQAgent } from './qqApi'
import type { QQStatus } from './qqApi'

const formatActiveAt = (value: string) => formatDateTime(value, { hour12: false, second: '2-digit' })

const DISCONNECTED_STATUS: QQStatus = {
  connected: false,
  gatewaySupported: false,
}

const MessengerQQPage = memo(() => {
  const { message } = useApp()
  const platformMeta = getMessengerPlatform('qq')!
  const [loading, setLoading] = useState(true)
  const [binding, setBinding] = useState(false)
  const [status, setStatus] = useState<QQStatus | null>(null)
  const [agents, setAgents] = useState<Array<{ label: string; value: string }>>([])
  const [agentId, setAgentId] = useState('agt_inbox')

  const refreshStatus = useCallback(async () => {
    const st = await fetchQQStatus()
    setStatus(st)
    if (st.agentId) setAgentId(st.agentId)
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
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void reload()
  }, [reload])

  const handleAgentChange = useCallback(
    async (value: string) => {
      setAgentId(value)
      if (!status?.applicationId || status.enabled === false) return
      try {
        await updateQQAgent(value)
        message.success('已更新绑定助手')
        await refreshStatus()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '更新失败')
      }
    },
    [message, refreshStatus, status]
  )

  const handleDisconnect = useCallback(() => {
    confirmModal({
      content: '断开后需重新填写 App ID / Secret 才能在 QQ 中对话。',
      okText: '断开',
      okButtonProps: { danger: true },
      onOk: async () => {
        await unbindQQ()
        setStatus(DISCONNECTED_STATUS)
        message.success('已断开 QQ')
        try {
          await refreshStatus()
        } catch {
          /* 已乐观断开 */
        }
      },
      title: '断开 QQ 连接？',
    })
  }, [message, refreshStatus])

  if (loading) {
    return (
      <MessengerDetailShell platform='qq' platformMeta={platformMeta}>
        <Flexbox align='center' justify='center' style={{ minHeight: 160 }}>
          <Spin />
        </Flexbox>
      </MessengerDetailShell>
    )
  }

  const connected = Boolean(status?.connected)
  const gatewaySupported = status?.gatewaySupported !== false
  const showConnect = !status?.applicationId

  const headerAction = showConnect ? (
    <QQConnectButton
      agentId={agentId}
      gatewaySupported={gatewaySupported}
      onConnected={async () => {
        setBinding(true)
        try {
          message.success('QQ 凭证已保存，正在建立连接')
          await refreshStatus()
        } finally {
          setBinding(false)
        }
      }}
    />
  ) : (
    <Button danger disabled={binding} icon={<Trash2Icon size={16} />} onClick={handleDisconnect}>
      断开
    </Button>
  )

  return (
    <MessengerDetailShell headerAction={headerAction} platform='qq' platformMeta={platformMeta}>
      <Flexbox gap={12}>
        <Text strong style={{ fontSize: 15 }}>
          连接 QQ
        </Text>

        <Flexbox gap={8}>
          <Text type='secondary' style={{ fontSize: 13 }}>
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
          <Alert
            showIcon
            type='info'
            title={gatewaySupported ? '支持扫码、WebSocket 与 URL 回调' : '当前部署仅支持 URL 回调'}
            description={gatewaySupported
              ? '点击右上角「连接」，推荐使用手机 QQ 扫码自动完成机器人授权。'
              : '扫码和 WebSocket 需要常驻 Gateway；点击右上角「连接」可使用 App ID / Secret 配置 URL 回调。'}
          />
        ) : (
          <>
              <Alert
                showIcon
                type={connected ? 'success' : 'warning'}
                title={connected ? '已连接 QQ' : 'QQ 绑定已保存，当前离线'}
                description={
                  status?.lastActiveAt
                    ? `最近活动：${formatActiveAt(status.lastActiveAt)} · 模式：${status.connectionMode ?? 'websocket'}`
                    : `模式：${status?.connectionMode ?? 'websocket'}。在 QQ 私聊或群内 @ 机器人即可对话。`
                }
              />
              {status?.connectionMode === 'webhook' && status.webhookUrl && (
                <Alert
                  showIcon
                  type='info'
                  title='Webhook 回调地址'
                  description={
                    <Text
                      style={{ cursor: 'copy', fontSize: 13 }}
                      title='点击复制'
                      onClick={async () => {
                        await copyToClipboard(status.webhookUrl!)
                        message.success('已复制 Webhook 回调地址')
                      }}
                    >
                      {status.webhookUrl}
                    </Text>
                  }
                />
              )}
              {status?.connectionMode === 'websocket' && status.runtimeStatus !== 'online' && (
                <Alert showIcon type='warning' title='QQ WebSocket 当前离线' description={status.lastError?.message || 'Next Server Gateway 正在等待连接或恢复。'} />
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
