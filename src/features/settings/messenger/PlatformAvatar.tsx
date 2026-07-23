'use client'

import { Discord, QQ, Slack, Telegram, WeChat } from '@pure/ui/icons'
import { type ReactNode } from 'react'

import { type MessengerPlatformId } from './const'

export const PlatformAvatar = ({ platform, size }: { platform: MessengerPlatformId; size: number }): ReactNode => {
  if (platform === 'telegram') return <Telegram.Avatar size={size} />
  if (platform === 'discord') return <Discord.Avatar size={size} />
  if (platform === 'wechat') return <WeChat.Avatar size={size} />
  if (platform === 'qq') return <QQ.Avatar size={size} />
  return <Slack.Avatar size={size} />
}
