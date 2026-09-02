import { PURECHAT_DEFAULT_MODEL } from '@pure/model-bank'
import { formatDateTime } from '@pure/utils/client'

import { CHANNEL_COMMAND_CATALOG } from '@/libs/channels/core/commands'
import type { ChannelCommandCatalogItem } from '@/libs/channels/core/commands'

export type MessengerPlatformId = 'slack' | 'telegram' | 'discord' | 'wechat' | 'qq'

export const MESSENGER_PROVIDER_IDS = ['purechat', 'openai', 'deepseek'] as const
export type MessengerProviderId = (typeof MESSENGER_PROVIDER_IDS)[number]
export const MESSENGER_DEFAULT_PROVIDER: MessengerProviderId = 'deepseek'
export const MESSENGER_DEFAULT_MODELS: Record<MessengerProviderId, string> = {
  deepseek: 'deepseek-v4-flash',
  openai: 'gpt-5.4-mini',
  purechat: PURECHAT_DEFAULT_MODEL,
}
/** QQ 与微信共用 DeepSeek 默认服务商。 */
export const QQ_DEFAULT_PROVIDER: MessengerProviderId = MESSENGER_DEFAULT_PROVIDER
export const QQ_DEFAULT_MODEL = MESSENGER_DEFAULT_MODELS[QQ_DEFAULT_PROVIDER]
export const isMessengerProviderId = (id: string): id is MessengerProviderId =>
  MESSENGER_PROVIDER_IDS.includes(id as MessengerProviderId)
export const formatMessengerActiveAt = (value: string) =>
  formatDateTime(value, { hourCycle: 'h23', second: '2-digit' })

export type MessengerPlatformMeta = {
  description: string
  id: MessengerPlatformId
  name: string
}

export const MESSENGER_SUBTITLE = '将你的账号连接到 PureChat 机器人。选择由哪个 Agent 接收消息，可随时从此处切换。'

export const MESSENGER_PLATFORMS: readonly MessengerPlatformMeta[] = [
  {
    description: '填写 QQ 开放平台 App ID / Secret，在私聊或群 @ 中与 Agent 对话。',
    id: 'qq',
    name: 'QQ',
  },
  {
    description: '使用微信扫码连接，与Agent对话。',
    id: 'wechat',
    name: 'WeChat',
  },
  // {
  //   description: '在任意 Slack 工作区中通过私信或 @PureChat 与你的 Agent 对话。',
  //   id: 'slack',
  //   name: 'Slack',
  // },
  // {
  //   description: '在 Telegram 中与你的 PureChat Agent 对话，随时切换接收消息的 Agent。',
  //   id: 'telegram',
  //   name: 'Telegram',
  // },
  // {
  //   description: '在任意 Discord 服务器中通过私信 PureChat 机器人与你的 Agent 对话。',
  //   id: 'discord',
  //   name: 'Discord',
  // },
] as const

export const getMessengerPlatform = (id: string): MessengerPlatformMeta | undefined =>
  MESSENGER_PLATFORMS.find((p) => p.id === id)

export type MessengerCommandItem = ChannelCommandCatalogItem

/** QQ / 微信共用同一套指令目录（与网关 runChannelCommand 对齐）。 */
export const MESSENGER_COMMANDS: readonly MessengerCommandItem[] = CHANNEL_COMMAND_CATALOG

/** @deprecated 使用 MESSENGER_COMMANDS */
export const QQ_COMMANDS = MESSENGER_COMMANDS
/** @deprecated 使用 MESSENGER_COMMANDS */
export const WECHAT_COMMANDS = MESSENGER_COMMANDS
