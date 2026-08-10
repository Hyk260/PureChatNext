export type MessengerPlatformId = 'slack' | 'telegram' | 'discord' | 'wechat' | 'qq'

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

export type MessengerCommandItem = {
  command: string
  description: string
  icon: 'agents' | 'new' | 'stop' | 'feedback' | 'help'
}

export const QQ_COMMANDS: readonly MessengerCommandItem[] = [
  {
    command: '/agents',
    description: '列出你的 Agent 并切换当前激活 Agent',
    icon: 'agents',
  },
  {
    command: '/new',
    description: '开启新对话',
    icon: 'new',
  },
  {
    command: '/stop',
    description: '停止当前执行',
    icon: 'stop',
  },
  {
    command: '/help',
    description: '在机器人中查看全部指令',
    icon: 'help',
  },
] as const

export const WECHAT_COMMANDS: readonly MessengerCommandItem[] = [
  {
    command: '/agents',
    description: '列出你的 Agent 并切换当前激活 Agent',
    icon: 'agents',
  },
  {
    command: '/new',
    description: '开启新对话',
    icon: 'new',
  },
  {
    command: '/stop',
    description: '停止当前执行',
    icon: 'stop',
  },
  {
    command: '/help（/h）',
    description: '在机器人中查看全部指令',
    icon: 'help',
  },
] as const
