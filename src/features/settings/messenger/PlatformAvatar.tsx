'use client'

import { Discord, Slack, Telegram, WeChat } from '@lobehub/ui/icons'
import type { ReactNode } from 'react'

import type { MessengerPlatformId } from './const'

export const PlatformAvatar = ({
  platform,
  size,
}: {
  platform: MessengerPlatformId
  size: number
}): ReactNode => {
  if (platform === 'telegram') return <Telegram.Avatar size={size} />
  if (platform === 'discord') return <Discord.Avatar size={size} />
  if (platform === 'wechat') return <WeChat.Avatar size={size} />
  return <Slack.Avatar size={size} />
}
