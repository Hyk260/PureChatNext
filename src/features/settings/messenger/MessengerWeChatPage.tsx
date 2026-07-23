'use client'

import { Flex, Typography, Button, Alert, Select, Spin } from 'antd'
import { useApp } from '@/components/AntdStaticMethods'
import { Trash2Icon } from 'lucide-react'
import { memo, useCallback, useEffect, useState } from 'react'

import { fetchAgents } from '@/features/home/agentApi'

import { getMessengerPlatform } from './const'
import MessengerCommandList from './MessengerCommandList'
import { MessengerDetailShell } from './MessengerDetailShell'
import QrCodeAuth, { type WechatAuthCredentials } from './QrCodeAuth'
import {
  bindWechat,
  fetchWechatStatus,
  unbindWechat,
  updateWechatAgent,
  type WechatStatus,
} from './wechatApi'

const STATUS_POLL_MS = 8_000

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

const DISCONNECTED_STATUS: WechatStatus = {
  connected: false,
  needsRebind: false,
}

const MessengerWeChatPage = memo(() => {
  const { message, modal } = useApp()
  const platformMeta = getMessengerPlatform('wechat')!
  const [loading, setLoading] = useState(true)
  const [binding, setBinding] = useState(false)
  const [status, setStatus] = useState<WechatStatus | null>(null)
  const [agents, setAgents] = useState<Array<{ label: string; value: string }>>([])
  const [agentId, setAgentId] = useState('agt_inbox')

  const refreshStatus = useCallback(async () => {
    const st = await fetchWechatStatus()
    setStatus(st)
    if (st.agentId) setAgentId(st.agentId)
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
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void reload()
  }, [reload])

  // 仅已连接时轮询：gateway 写 needsRebind 后及时反映；断开后停掉
  useEffect(() => {
    if (loading || !status?.connected || status.needsRebind) return

    const tick = () => {
      void refreshStatus().catch(() => {
        /* 静默：轮询失败不打扰 */
      })
    }

    const id = window.setInterval(tick, STATUS_POLL_MS)
    return () => window.clearInterval(id)
  }, [loading, refreshStatus, status?.connected, status?.needsRebind])

  const handleAuthenticated = useCallback(
    async (credentials: WechatAuthCredentials) => {
      setBinding(true)
      try {
        await bindWechat({
          agentId,
          botId: credentials.botId,
          botToken: credentials.botToken,
          userId: credentials.userId,
        })
        // 先乐观切到已连接，再拉一次真实状态
        setStatus({
          agentId,
          connected: true,
          enabled: true,
          lastActiveAt: new Date().toISOString(),
          needsRebind: false,
        })
        message.success('微信已连接')
        await refreshStatus()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '绑定失败')
      } finally {
        setBinding(false)
      }
    },
    [agentId, message, refreshStatus],
  )

  const handleAgentChange = useCallback(
    async (value: string) => {
      setAgentId(value)
      if (!status?.connected || status.needsRebind || status.enabled === false) return
      try {
        await updateWechatAgent(value)
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
      content: '断开后需重新扫码才能在微信中对话。',
      okText: '断开',
      cancelText: '取消',
      okType: 'danger',
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
  }, [message, modal, refreshStatus])

  if (loading) {
    return (
      <MessengerDetailShell platform="wechat" platformMeta={platformMeta}>
        <Flex vertical align="center" justify="center" style={{ minHeight: 160 }}>
          <Spin />
        </Flex>
      </MessengerDetailShell>
    )
  }

  const connected = Boolean(status?.connected)
  const needsRebind = Boolean(status?.needsRebind) || (connected && status?.enabled === false)
  const showConnect = !connected || needsRebind

  // 未连接显示「连接」，已连接显示「断开」
  const headerAction = showConnect ? (
    <QrCodeAuth disabled={binding} onAuthenticated={(c) => void handleAuthenticated(c)} />
  ) : (
    <Button danger disabled={binding} icon={<Trash2Icon size={16} />} onClick={handleDisconnect}>
      断开
    </Button>
  )

  return (
    <MessengerDetailShell
      headerAction={headerAction}
      platform="wechat"
      platformMeta={platformMeta}
    >
      <Flex vertical gap={8}>
        <Typography.Text strong style={{ fontSize: 15 }}>
          连接微信
        </Typography.Text>

        <Flex vertical gap={8}>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            绑定助手
          </Typography.Text>
          <Select
            options={agents}
            style={{ maxWidth: 360 }}
            value={agentId}
            onChange={(v) => void handleAgentChange(v)}
          />
        </Flex>

        {needsRebind && (
          <Alert
            showIcon
            type="warning"
            title="微信会话已过期或需要重新连接"
            description="请再次扫码绑定。"
          />
        )}

        {showConnect ? (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            打开手机微信 → 右上角「+」→ 扫一扫，扫描二维码并确认。
          </Typography.Text>
        ) : (
          <Alert
            showIcon
            type="success"
            title="已连接微信"
            description={
              status?.lastActiveAt
                ? `最近活动：${formatActiveAt(status.lastActiveAt)}`
                : '打开微信私聊机器人即可对话。'
            }
          />
        )}
      </Flex>

      <MessengerCommandList />
    </MessengerDetailShell>
  )
})

MessengerWeChatPage.displayName = 'MessengerWeChatPage'

export default MessengerWeChatPage
