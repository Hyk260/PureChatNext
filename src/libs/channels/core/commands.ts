export type ChannelCommandName = 'agents' | 'help' | 'new' | 'stop'

export type ParsedChannelCommand = {
  argument: string
  name: ChannelCommandName | (string & {})
}

export type ChannelCommandCatalogItem = {
  command: string
  description: string
  icon: 'agents' | 'feedback' | 'help' | 'new' | 'stop'
  name: ChannelCommandName
}

/** 设置页与网关帮助文案共用的指令目录。 */
export const CHANNEL_COMMAND_CATALOG: readonly ChannelCommandCatalogItem[] = [
  {
    command: '/agents',
    description: '列出你的 Agent 并切换当前激活 Agent',
    icon: 'agents',
    name: 'agents',
  },
  {
    command: '/new',
    description: '开启新对话',
    icon: 'new',
    name: 'new',
  },
  {
    command: '/stop',
    description: '停止当前执行',
    icon: 'stop',
    name: 'stop',
  },
  {
    command: '/help（/h）',
    description: '在机器人中查看全部指令',
    icon: 'help',
    name: 'help',
  },
] as const

export type ChannelCommandAgent = {
  id: string
  title: string
}

export type ChannelCommandEffects = {
  abortActiveGeneration: () => boolean
  /** 返回错误文案则禁止 /agents；返回 null 表示允许。 */
  assertAgentsAllowed?: () => Promise<string | null>
  getCurrentAgentId: () => Promise<string>
  listAgents: () => Promise<ChannelCommandAgent[]>
  /** 开启新对话；传入 agentId 时同时切换助手。 */
  startNewConversation: (agentId?: string) => Promise<void>
}

export function buildChannelHelpText(options?: { footer?: string }) {
  const lines = [
    '可用指令：',
    '/help（/h） — 查看帮助',
    '/new — 取消当前生成并开始新对话',
    '/stop — 停止当前生成',
    '/agents — 查看可用助手',
    '/agents <序号|agentId> — 切换助手并开始新对话',
  ]
  if (options?.footer) {
    lines.push('', options.footer)
  }
  return lines.join('\n')
}

/** 首次绑定欢迎语默认开启；预留设置页通过 `enabled` 控制。 */
export const DEFAULT_CHANNEL_FIRST_BIND_WELCOME_ENABLED = true

/** 欢迎语与首条 Agent 回复之间的分隔符。 */
export const CHANNEL_FIRST_BIND_WELCOME_SEPARATOR = '\n\n---\n\n'

export type ChannelFirstBindWelcomeOptions = {
  /** 是否启用首次绑定提示，默认 true。 */
  enabled?: boolean
  helpHint?: string
}

/** QQ / 微信共用的首次绑定欢迎语。 */
export function buildChannelWelcomeText(
  agentTitle: string,
  options?: ChannelFirstBindWelcomeOptions
): string | null {
  if (options?.enabled === false) return null
  const name = agentTitle.trim() || '助手'
  return [`「${name}」已接入，直接发消息即可。`, options?.helpHint ?? '发送 /h 查看全部指令。'].join('\n')
}

export function prependChannelFirstBindWelcome(reply: string, welcome: string | null): string {
  if (!welcome) return reply
  return `${welcome}${CHANNEL_FIRST_BIND_WELCOME_SEPARATOR}${reply}`
}

/** 消费 pendingWelcome 并将欢迎语拼到首条出站回复前（iLink / QQ 均无法绑定时主动推送）。 */
export async function applyChannelFirstBindWelcome(params: {
  agentTitle: string
  bindingId: string
  clearPendingWelcome: (id: string) => Promise<{ id: string } | null>
  enabled?: boolean
  pendingWelcome: boolean
  reply: string
}): Promise<string> {
  if (!params.pendingWelcome) return params.reply
  const welcome = buildChannelWelcomeText(params.agentTitle, {
    enabled: params.enabled ?? DEFAULT_CHANNEL_FIRST_BIND_WELCOME_ENABLED,
  })
  if (!welcome) {
    await params.clearPendingWelcome(params.bindingId)
    return params.reply
  }
  const cleared = await params.clearPendingWelcome(params.bindingId)
  if (!cleared) return params.reply
  return prependChannelFirstBindWelcome(params.reply, welcome)
}

export function parseChannelCommand(input: string): ParsedChannelCommand | null {
  const match = input.trim().match(/^\/([a-z]+)(?:[ \t]+([^\r\n]+))?$/i)
  if (!match) return null
  const rawName = match[1]!.toLowerCase()
  return {
    argument: match[2]?.trim() ?? '',
    name: rawName === 'h' ? 'help' : rawName,
  }
}

async function handleAgentsCommand(argument: string, effects: ChannelCommandEffects) {
  if (effects.assertAgentsAllowed) {
    const denied = await effects.assertAgentsAllowed()
    if (denied) return denied
  }

  const agents = await effects.listAgents()
  const current = await effects.getCurrentAgentId()

  if (!argument) {
    return [
      '可用助手：',
      ...agents.map((agent, index) => {
        const marker = agent.id === current ? '（当前）' : ''
        return `${index + 1}. ${agent.title} [${agent.id}]${marker}`
      }),
      '',
      '发送 /agents <序号|agentId> 切换助手。',
    ].join('\n')
  }

  const index = /^\d+$/.test(argument) ? Number(argument) - 1 : -1
  const target = index >= 0 ? agents[index] : agents.find((agent) => agent.id === argument)
  if (!target) return '未找到该助手。发送 /agents 查看列表。'

  await effects.startNewConversation(target.id)
  effects.abortActiveGeneration()
  return `已切换到「${target.title}」，并创建新对话。`
}

/**
 * 执行渠道指令。
 * @returns 指令回复文案；非指令时返回 null。
 */
export async function runChannelCommand(
  input: string,
  effects: ChannelCommandEffects,
  options?: { helpText?: string }
): Promise<string | null> {
  const command = parseChannelCommand(input)
  if (!command) return null

  const helpText = options?.helpText ?? buildChannelHelpText()

  switch (command.name) {
    case 'help':
      return helpText
    case 'new':
      effects.abortActiveGeneration()
      await effects.startNewConversation()
      return '已创建新对话，后续消息不会使用旧对话上下文。'
    case 'stop': {
      const stopped = effects.abortActiveGeneration()
      return stopped ? '已停止当前生成。' : '当前没有正在生成的回复。'
    }
    case 'agents':
      return handleAgentsCommand(command.argument, effects)
    default:
      return `未知指令 /${command.name}。\n\n${helpText}`
  }
}
