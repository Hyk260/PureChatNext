import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findByUserAndPlatform: vi.fn(),
  findUserById: vi.fn(),
  invalidateQQChat: vi.fn(),
  listVisible: vi.fn(),
  updateAgent: vi.fn(),
}))

vi.mock('@pure/database/models/agent', () => ({
  AgentModel: class {
    listVisible = mocks.listVisible
  },
}))

vi.mock('@pure/database/models/channelBinding', () => ({
  ChannelBindingModel: class {
    findByUserAndPlatform = mocks.findByUserAndPlatform
    updateAgent = mocks.updateAgent
  },
  QQ_PLATFORM: 'qq',
}))

vi.mock('@pure/database/models/user', () => ({
  UserModel: class {
    findById = mocks.findUserById
  },
}))

vi.mock('@/libs/constants', () => ({ isDev: true }))

vi.mock('../chatBot', () => ({
  invalidateQQChat: mocks.invalidateQQChat,
}))

import {
  abortQQGeneration,
  beginQQGeneration,
  canUseQQDevelopmentTTSCommand,
  endQQGeneration,
  flushQQChatInvalidation,
  parseQQDevelopmentTTSCommand,
  QQ_HELP_TEXT,
  tryHandleQQCommand,
} from '../commands'

describe('QQ commands', () => {
  beforeEach(() => {
    mocks.findByUserAndPlatform.mockReset()
    mocks.findUserById.mockReset()
    mocks.invalidateQQChat.mockReset()
    mocks.listVisible.mockReset()
    mocks.updateAgent.mockReset()
    mocks.findByUserAndPlatform.mockResolvedValue({ agentId: 'agt_a' })
    mocks.listVisible.mockResolvedValue([
      { id: 'agt_a', title: '助手 A' },
      { id: 'agt_b', title: '助手 B' },
    ])
    mocks.updateAgent.mockResolvedValue({ agentId: 'agt_b' })
    mocks.invalidateQQChat.mockResolvedValue(undefined)
  })

  it('parses tagged TTS text from quoted and unquoted parameters', () => {
    const taggedText = '[excited]今天的天气真不错！[laughing]我们一起出去玩吧！'
    expect(parseQQDevelopmentTTSCommand(`/tts text='${taggedText}'`)).toEqual({ text: taggedText })
    expect(parseQQDevelopmentTTSCommand(`/tts text=‘${taggedText}’`)).toEqual({ text: taggedText })
    expect(parseQQDevelopmentTTSCommand(`/tts text=“${taggedText}”`)).toEqual({ text: taggedText })
    expect(parseQQDevelopmentTTSCommand(`/tts text=${taggedText}`)).toEqual({ text: taggedText })
    expect(parseQQDevelopmentTTSCommand('/tts text=\'unterminated')).toEqual({ error: 'usage' })
    expect(parseQQDevelopmentTTSCommand('/tts unknown=value')).toEqual({ error: 'usage' })
    expect(parseQQDevelopmentTTSCommand('/help')).toBeNull()
  })

  it('allows the active admin binding owner without comparing a QQ member id', async () => {
    mocks.findUserById.mockResolvedValue({ banned: false, role: 'admin' })
    await expect(canUseQQDevelopmentTTSCommand('account-owner')).resolves.toBe(true)
    expect(mocks.findUserById).toHaveBeenCalledWith('account-owner')

    mocks.findUserById.mockResolvedValue({ banned: true, role: 'admin' })
    await expect(canUseQQDevelopmentTTSCommand('account-owner')).resolves.toBe(false)

    mocks.findUserById.mockResolvedValue({ banned: false, role: 'user' })
    await expect(canUseQQDevelopmentTTSCommand('account-owner')).resolves.toBe(false)
  })

  it('documents the same command surface as WeChat', () => {
    for (const command of ['/h', '/help', '/new', '/stop', '/agents']) {
      expect(QQ_HELP_TEXT).toContain(command)
    }
  })

  it('handles help/new/stop without calling the model path', async () => {
    await expect(
      tryHandleQQCommand({
        applicationId: 'app-1',
        externalUserId: 'u-1',
        text: '/help',
        userId: 'user-1',
      })
    ).resolves.toContain('可用指令')

    await expect(
      tryHandleQQCommand({
        applicationId: 'app-1',
        externalUserId: 'u-1',
        text: '/new',
        userId: 'user-1',
      })
    ).resolves.toContain('已创建新对话')

    await flushQQChatInvalidation('app-1')
    expect(mocks.invalidateQQChat).toHaveBeenCalledWith('app-1')
  })

  it('lists and switches agents then invalidates chat', async () => {
    const list = await tryHandleQQCommand({
      applicationId: 'app-1',
      externalUserId: 'u-1',
      text: '/agents',
      userId: 'user-1',
    })
    expect(list).toContain('助手 A')

    await expect(
      tryHandleQQCommand({
        applicationId: 'app-1',
        externalUserId: 'u-1',
        text: '/agents 2',
        userId: 'user-1',
      })
    ).resolves.toContain('助手 B')
    expect(mocks.updateAgent).toHaveBeenCalledWith('user-1', 'qq', 'agt_b')

    await flushQQChatInvalidation('app-1')
    expect(mocks.invalidateQQChat).toHaveBeenCalledWith('app-1')
  })

  it('aborts an in-flight generation on /stop', async () => {
    const controller = beginQQGeneration('app-1', 'u-1')
    expect(controller.signal.aborted).toBe(false)
    expect(abortQQGeneration('app-1', 'u-1')).toBe(true)
    expect(controller.signal.aborted).toBe(true)

    const next = beginQQGeneration('app-1', 'u-1')
    endQQGeneration('app-1', 'u-1', next)
    expect(abortQQGeneration('app-1', 'u-1')).toBe(false)
  })

  it('returns null for ordinary chat text', async () => {
    await expect(
      tryHandleQQCommand({
        applicationId: 'app-1',
        externalUserId: 'u-1',
        text: '你好',
        userId: 'user-1',
      })
    ).resolves.toBeNull()
  })
})
