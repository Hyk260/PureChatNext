export type ChannelLogPlatform = 'qq' | 'wechat'

export type ChannelGatewayLogs = { text: string; truncated: boolean }

export const CHANNEL_LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
export const CHANNEL_LOG_LIMIT = 200
export const CHANNEL_LOG_MAX_BYTES = 256 * 1024

export const CHANNEL_LOG_MESSAGES = {
  bound: '渠道绑定已保存',
  starting: '正在启动网关连接',
  online: '网关已上线',
  recovered: '网关连接已恢复',
  offline: '网关连接中断',
  disconnected: '渠道已断开',
  retry: '已安排重试',
  lease_lost: '网关租约丢失，当前连接已停止',
  needs_rebind: '授权已过期，需要重新绑定',
  authorization_failed: '渠道授权失败，请检查凭据或签名配置',
  callback_failed: '渠道回调转发或处理失败',
  processing_failed: '消息处理失败',
  send_failed: '回复发送失败',
} as const

export type ChannelLogEvent = keyof typeof CHANNEL_LOG_MESSAGES

export type ChannelLogInput = {
  userId: string
  platform: ChannelLogPlatform
  bindingId?: string
  event: ChannelLogEvent
  code?: string
  attempt?: number
  delayMs?: number
}

export const isChannelLogPlatform = (value: string): value is ChannelLogPlatform =>
  value === 'qq' || value === 'wechat'
