import { Button, confirmModal, Flex, Modal, Text } from '@pure/ui'
import type { ChannelGatewayLogs, ChannelLogPlatform } from '@pure/types'
import useSWR from 'swr'
import { useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import { apiFetch } from '@/utils/apiFetch'
import { getDesktopRemoteBaseUrl } from '@/utils/desktopFetch'

type Props = {
  userId: string | undefined
  platform: ChannelLogPlatform
  bound: boolean
  gatewaySupported: boolean
  connectionMode?: string
  onClose: () => void
}

function statusDescription({ bound, platform, gatewaySupported, connectionMode }: Props) {
  if (platform === 'qq' && connectionMode === 'webhook') return 'QQ Webhook 模式无需常驻 Gateway，可查看回调诊断。'
  if (!gatewaySupported) return '当前部署不支持常驻 Gateway，仍可查看保留的服务端诊断记录。'
  if (!bound) return '当前渠道未绑定，断开或重新绑定前的记录会保留到期。'
  return '查看服务端连接和处理异常；离线时也可读取历史记录。'
}

async function fetchLogs(platform: ChannelLogPlatform): Promise<ChannelGatewayLogs> {
  const response = await apiFetch(`/api/channels/${platform}/logs`, { cache: 'no-store' })
  if (!response.ok) throw new Error('无法读取服务端诊断日志')
  return response.json() as Promise<ChannelGatewayLogs>
}

export function ChannelGatewayLogsModal(props: Props) {
  const { platform, userId, onClose } = props
  const { message } = useApp()
  const [isClearing, setIsClearing] = useState(false)
  const service = getDesktopRemoteBaseUrl() || window.location.origin
  const { data, error, isValidating, mutate } = useSWR(
    userId ? ['channel:diagnostics', userId, platform, service] : null,
    () => fetchLogs(platform),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    },
  )

  const handleRefresh = () => {
    mutate().catch(() => undefined)
  }

  const handleClear = () => {
    confirmModal({
      content: `将永久删除当前账号的${platform === 'qq' ? 'QQ' : '微信'}诊断日志，无法恢复。`,
      okText: '清除日志',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setIsClearing(true)
        try {
          const response = await apiFetch(`/api/channels/${platform}/logs`, { method: 'DELETE' })
          if (!response.ok) throw new Error('清除日志失败')
          await mutate({ text: '', truncated: false }, { revalidate: false })
          message.success('诊断日志已清除')
        } catch {
          message.error('清除诊断日志失败，请重试')
        } finally {
          setIsClearing(false)
        }
      },
      title: '清除诊断日志？',
    })
  }

  let logText = data?.text
  if (!logText) {
    if (isValidating) logText = '正在读取日志…'
    else if (error) logText = '日志读取失败。'
    else logText = '暂无服务端诊断记录。'
  }

  return (
    <Modal
      open
      title={`${platform === 'qq' ? 'QQ' : '微信'}网关诊断日志`}
      width={880}
      onCancel={onClose}
      footer={(
        <Flex className='justify-end gap-2'>
          <Button danger disabled={isClearing} loading={isClearing} onClick={handleClear}>清除日志</Button>
          <Button loading={isValidating} onClick={handleRefresh}>更新</Button>
          <Button onClick={onClose}>关闭</Button>
        </Flex>
      )}
    >
      <Flex className='flex-col gap-3'>
        <Text>{statusDescription(props)}</Text>
        <Text className='text-xs' type='secondary'>
          {platform === 'qq'
            ? '服务端诊断日志：最近 7 天，每个平台最多 200 条；入站消息和 Agent 回复正文最多显示 500 字，包含 QQ OpenID 与昵称，不记录凭据。'
            : '服务端诊断日志：最近 7 天，每个平台最多 200 条；入站消息和 Agent 回复正文最多显示 500 字，包含微信用户 ID，不记录凭据。'}
          {data?.truncated ? '已达到保留或显示上限，较早的日志可能已省略。' : ''}
        </Text>
        {error ? (
          <Text role='alert' className='text-red'>无法读取服务端诊断日志，请检查服务连接后刷新重试。{data ? '下方显示上次读取的记录。' : ''}</Text>
        ) : null}
        <pre
          aria-label='服务端诊断日志'
          aria-busy={isValidating}
          className='m-0 max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-secondary p-3 text-xs'
        >
          {logText}
        </pre>
      </Flex>
    </Modal>
  )
}
