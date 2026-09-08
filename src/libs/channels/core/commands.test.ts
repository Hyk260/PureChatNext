import { describe, expect, it, vi } from 'vitest'

import type { ChannelCommandEffects } from './commands'
import {
  applyChannelFirstBindWelcome,
  buildAgentSwitchReply,
  buildChannelHelpText,
  buildChannelWelcomeText,
  CHANNEL_COMMAND_CATALOG,
  CHANNEL_FIRST_BIND_WELCOME_SEPARATOR,
  DEFAULT_CHANNEL_AGENT_SWITCH_QUESTION_COUNT,
  DEFAULT_CHANNEL_FIRST_BIND_WELCOME_ENABLED,
  parseChannelCommand,
  prependChannelFirstBindWelcome,
  runChannelCommand,
} from './commands'

const createEffects = (overrides?: Partial<ChannelCommandEffects>): ChannelCommandEffects => ({
  abortActiveGeneration: vi.fn(() => false),
  getCurrentAgentId: vi.fn(async () => 'agt_a'),
  listAgents: vi.fn(async () => [
    { id: 'agt_a', title: '助手 A' },
    { id: 'agt_b', title: '助手 B' },
  ]),
  startNewConversation: vi.fn(async () => undefined),
  ...overrides,
})

describe('parseChannelCommand', () => {
  it('accepts only a complete command with an optional single-line argument', () => {
    expect(parseChannelCommand('/help')).toEqual({ argument: '', name: 'help' })
    expect(parseChannelCommand('/h')).toEqual({ argument: '', name: 'help' })
    expect(parseChannelCommand('/agents  2')).toEqual({ argument: '2', name: 'agents' })
    expect(parseChannelCommand('/agents agt_custom')).toEqual({ argument: 'agt_custom', name: 'agents' })
    expect(parseChannelCommand('hello /help')).toBeNull()
    expect(parseChannelCommand('/help\nignore')).toBeNull()
    expect(parseChannelCommand('/agents 2 extra\nignore')).toBeNull()
  })
})

describe('buildChannelHelpText', () => {
  it('documents every catalog command', () => {
    const help = buildChannelHelpText({ footer: '仅支持私聊文本' })
    for (const command of ['/h', '/help', '/new', '/stop', '/agents']) expect(help).toContain(command)
    expect(help).toContain('仅支持私聊文本')
  })

  it('keeps catalog aligned with help text', () => {
    expect(CHANNEL_COMMAND_CATALOG.map((item) => item.name)).toEqual(['agents', 'new', 'stop', 'help'])
  })
})

describe('buildChannelWelcomeText', () => {
  it('introduces the agent and points users to /h without greeting phrasing', () => {
    const text = buildChannelWelcomeText('旅行助手')
    expect(text).toContain('「旅行助手」已接入')
    expect(text).not.toContain('你好')
    expect(text).toContain('/h')
  })

  it('falls back when the agent title is blank', () => {
    expect(buildChannelWelcomeText('  ')).toContain('「助手」已接入')
  })

  it('returns null when disabled', () => {
    expect(buildChannelWelcomeText('旅行助手', { enabled: false })).toBeNull()
  })

  it('defaults welcome to enabled', () => {
    expect(DEFAULT_CHANNEL_FIRST_BIND_WELCOME_ENABLED).toBe(true)
  })
})

describe('prependChannelFirstBindWelcome', () => {
  it('joins welcome and reply with the shared separator', () => {
    const merged = prependChannelFirstBindWelcome('agent reply', 'welcome line')
    expect(merged).toBe(`welcome line${CHANNEL_FIRST_BIND_WELCOME_SEPARATOR}agent reply`)
  })
})

describe('applyChannelFirstBindWelcome', () => {
  it('prepends welcome once and clears pending flag', async () => {
    const clearPendingWelcome = vi.fn(async () => ({ id: 'binding-1' }))
    const merged = await applyChannelFirstBindWelcome({
      agentTitle: '旅行助手',
      bindingId: 'binding-1',
      clearPendingWelcome,
      pendingWelcome: true,
      reply: '这是回复',
    })
    expect(merged).toContain('「旅行助手」已接入')
    expect(merged).toContain('这是回复')
    expect(clearPendingWelcome).toHaveBeenCalledWith('binding-1')
  })

  it('skips when pendingWelcome is false', async () => {
    const clearPendingWelcome = vi.fn(async () => ({ id: 'binding-1' }))
    await expect(
      applyChannelFirstBindWelcome({
        agentTitle: '旅行助手',
        bindingId: 'binding-1',
        clearPendingWelcome,
        pendingWelcome: false,
        reply: '这是回复',
      })
    ).resolves.toBe('这是回复')
    expect(clearPendingWelcome).not.toHaveBeenCalled()
  })
})

describe('runChannelCommand', () => {
  it('returns null for non-commands', async () => {
    await expect(runChannelCommand('你好', createEffects())).resolves.toBeNull()
  })

  it('handles help/new/stop', async () => {
    const effects = createEffects({ abortActiveGeneration: vi.fn(() => true) })
    await expect(runChannelCommand('/help', effects)).resolves.toContain('可用指令')
    await expect(runChannelCommand('/new', effects)).resolves.toContain('已创建新对话')
    expect(effects.abortActiveGeneration).toHaveBeenCalled()
    expect(effects.startNewConversation).toHaveBeenCalledWith()
    await expect(runChannelCommand('/stop', effects)).resolves.toBe('已停止当前生成。')
  })

  it('lists and switches agents', async () => {
    const effects = createEffects({
      listAgents: vi.fn(async () => [
        { id: 'agt_a', title: '助手 A' },
        {
          id: 'agt_b',
          openingMessage: '您好！我是 Next.js 专家顾问。',
          openingQuestions: ['我如何提升性能？', '有哪些 SEO 实践？', '如何调试 hydration？'],
          title: '助手 B',
        },
      ]),
    })
    const list = await runChannelCommand('/agents', effects)
    expect(list).toContain('助手 A')
    expect(list).toContain('（当前）')

    const switched = await runChannelCommand('/agents 2', effects)
    expect(switched).toContain('已切换到「助手 B」')
    expect(switched).toContain('您好！我是 Next.js 专家顾问。')
    expect(switched).toContain('1. 我如何提升性能？')
    expect(switched).toContain('2. 有哪些 SEO 实践？')
    expect(switched).not.toContain('如何调试 hydration？')
    expect(effects.startNewConversation).toHaveBeenCalledWith('agt_b')
    expect(effects.abortActiveGeneration).toHaveBeenCalled()
  })

  it('respects assertAgentsAllowed', async () => {
    const effects = createEffects({
      assertAgentsAllowed: vi.fn(async () => '该指令仅限授权账号使用。'),
    })
    await expect(runChannelCommand('/agents', effects)).resolves.toBe('该指令仅限授权账号使用。')
  })
})

describe('buildAgentSwitchReply', () => {
  it('defaults to two questions and clamps questionCount to 1–4', () => {
    expect(DEFAULT_CHANNEL_AGENT_SWITCH_QUESTION_COUNT).toBe(2)

    const agent = {
      id: 'agt_x',
      openingMessage: '介绍文案',
      openingQuestions: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'],
      title: '顾问',
    }

    expect(buildAgentSwitchReply(agent)).toContain('1. Q1')
    expect(buildAgentSwitchReply(agent)).toContain('2. Q2')
    expect(buildAgentSwitchReply(agent)).not.toContain('3. Q3')

    expect(buildAgentSwitchReply(agent, { questionCount: 1 })).not.toContain('2. Q2')
    expect(buildAgentSwitchReply(agent, { questionCount: 4 })).toContain('4. Q4')
    expect(buildAgentSwitchReply(agent, { questionCount: 4 })).not.toContain('5. Q5')
    expect(buildAgentSwitchReply(agent, { questionCount: 99 })).toContain('4. Q4')
  })

  it('uses fallback intro and questions when agent fields are missing', () => {
    const text = buildAgentSwitchReply({ id: 'agt_y', title: '纯净助手' })
    expect(text).toContain('已切换到「纯净助手」')
    expect(text).toContain('「纯净助手」已就绪，直接发消息即可开始。')
    expect(text).toContain('1. 你能帮我做什么？')
    expect(text).toContain('2. 我们从哪里开始比较好？')
  })
})
