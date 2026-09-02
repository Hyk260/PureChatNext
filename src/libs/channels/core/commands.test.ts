import { describe, expect, it, vi } from 'vitest'

import type { ChannelCommandEffects } from './commands'
import {
  applyChannelFirstBindWelcome,
  buildChannelHelpText,
  buildChannelWelcomeText,
  CHANNEL_COMMAND_CATALOG,
  CHANNEL_FIRST_BIND_WELCOME_SEPARATOR,
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
    const effects = createEffects()
    const list = await runChannelCommand('/agents', effects)
    expect(list).toContain('助手 A')
    expect(list).toContain('（当前）')

    await expect(runChannelCommand('/agents 2', effects)).resolves.toContain('助手 B')
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
