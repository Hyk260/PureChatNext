export type MessengerPlatformId = 'slack' | 'telegram' | 'discord' | 'wechat'

export type MessengerPlatformMeta = {
  description: string
  id: MessengerPlatformId
  name: string
}

export const MESSENGER_SUBTITLE =
  '将你的账号连接到 PureChat 机器人。选择由哪个 Agent 接收消息，可随时从此处切换。'

export const MESSENGER_PLATFORMS: readonly MessengerPlatformMeta[] = [
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
  {
    description: '在任意 Discord 服务器中通过私信 PureChat 机器人与你的 Agent 对话。',
    id: 'discord',
    name: 'Discord',
  },
  {
    description: '使用微信扫码连接，私聊你的 PureChat Agent。',
    id: 'wechat',
    name: 'WeChat',
  },
] as const

export const getMessengerPlatform = (id: string): MessengerPlatformMeta | undefined =>
  MESSENGER_PLATFORMS.find((p) => p.id === id)

export type MessengerCommandItem = {
  command: string
  description: string
  icon: 'agents' | 'new' | 'stop' | 'feedback' | 'help'
}

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
    command: '/feedback',
    description: '向团队发送反馈（不会触发 AI 回复），如 /feedback 你的反馈内容',
    icon: 'feedback',
  },
  {
    command: '/help',
    description: '在机器人中查看全部指令',
    icon: 'help',
  },
] as const
