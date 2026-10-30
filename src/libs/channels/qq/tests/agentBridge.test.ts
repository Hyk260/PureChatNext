// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQQAdapter, QQAdapter } from '@pure/chat-adapter/qq'
import type { Message, Thread } from 'chat'

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  speech: vi.fn(),
  sendText: vi.fn(),
  save: vi.fn(),
  command: vi.fn(),
  controller: new AbortController(),
}))
vi.mock('@/server/agents/service', () => ({ AgentService: class {} }))
vi.mock('@pure/database/models/channelBinding', () => ({
  QQ_PLATFORM: 'qq',
  ChannelBindingModel: class {
    findById = vi.fn(async () => ({ settings: {} }))
    findByUserAndPlatform = vi.fn(async () => null)
  },
}))
vi.mock('@pure/database/models/channelEvent', () => ({
  ChannelEventModel: class {
    ingestQQInbound = vi.fn(async () => ({
      inserted: true,
      event: { id: 'event', sessionId: 'session', conversationVersion: 1 },
    }))
    findContext = vi.fn(async () => [])
    saveQQResponse = mocks.save
  },
}))
vi.mock('@pure/database/models/qqSpeech', () => ({
  QQSpeechModel: class {
    reserveReply = vi.fn()
  },
}))
vi.mock('@/server/chat/toolRegistry', () => ({ resolveChatTools: () => ({}), resolveChatToolInstructions: () => [] }))
vi.mock('@/server/channel-gateway/diagnostics', () => ({
  recordChannelGatewayLog: vi.fn(async () => {}),
  channelErrorCode: () => 'Error',
}))
vi.mock('@/libs/channels/core/files', () => ({ buildConversationFileContext: () => '' }))
vi.mock('@/libs/channels/core/agentRuntime', () => ({
  createChannelGenerationControls: () => ({}),
  generateChannelAgentReply: mocks.generate,
}))
vi.mock('@/libs/channels/core/modelResolver', () => ({
  resolveChannelModelConfig: () => ({ provider: 'deepseek', model: 'chat' }),
}))
vi.mock('@/libs/channels/wechat/fileArtifacts', () => ({
  listWechatConversationFiles: vi.fn(async () => []),
  persistWechatFile: vi.fn(),
  readWechatFile: vi.fn(),
}))
vi.mock('../inboundMedia', () => ({ prepareQQFileForAgent: vi.fn() }))
vi.mock('../commands', () => ({
  beginQQGeneration: () => mocks.controller,
  endQQGeneration: vi.fn(),
  flushQQChatInvalidation: vi.fn(async () => {}),
  tryHandleQQCommand: mocks.command,
}))
vi.mock('../speech', () => ({
  isQQSpeechCandidate: (input: string) => input.includes('语音'),
  tryQQSpeech: mocks.speech,
}))
vi.mock('../inboundLog', () => ({
  formatQQAttachmentContext: () => '',
  formatQQUnsupportedMessage: () => '',
  logQQInbound: vi.fn(),
  recordQQAgentReplyDiagnostic: vi.fn(async () => {}),
  recordQQInboundDiagnostic: vi.fn(async () => {}),
  resolveQQInboundKind: () => 'text',
}))

import { handleQQMention } from '../agentBridge'

describe('QQ generated reply delivery', () => {
  const reply = '你好，今天想聊点什么？'
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    mocks.controller = new AbortController()
    mocks.generate.mockResolvedValue({
      text: reply,
      model: 'chat',
      provider: 'deepseek',
      durationMs: 1,
      diagnostics: { agentId: 'agent', steps: [], contextMessageCount: 0, toolsAvailable: [], toolsCalled: [] },
    })
    mocks.command.mockResolvedValue(null)
    mocks.speech.mockResolvedValue('text')
    mocks.sendText.mockReset().mockResolvedValue(undefined)
    mocks.save.mockResolvedValue(undefined)
    vi.spyOn(QQAdapter.prototype, 'createReplySender').mockReturnValue({
      usedSeq: 0,
      assertAvailable: vi.fn(),
      sendAudio: vi.fn(),
      sendText: mocks.sendText,
    })
  })

  function params(text = '用语音回复我，你好') {
    const thread = {
      id: 'qq:c2c:user',
      adapter: createQQAdapter({ appId: 'app', clientSecret: 'secret' }),
      isDM: true,
      post: vi.fn(),
      startTyping: vi.fn(async () => {}),
    } as unknown as Thread
    const message = {
      id: 'inbound',
      text,
      attachments: [],
      author: { userId: 'sender', isBot: false },
      metadata: { dateSent: new Date() },
    } as unknown as Message
    return { thread, message, agentId: 'agent', applicationId: 'app', bindingId: 'binding', userId: 'owner' }
  }

  it('records the text and one delivered voice without posting duplicate text', async () => {
    mocks.speech.mockResolvedValue('sent')
    const input = params()
    await handleQQMention(input)
    expect(mocks.sendText).not.toHaveBeenCalled()
    expect(input.thread.post).not.toHaveBeenCalled()
    expect(mocks.save).toHaveBeenCalledWith('event', expect.objectContaining({ text: reply, sentChunkCount: 1 }))
  })

  it('removes Qwen tags from the plain text fallback and keeps other bracketed text', async () => {
    const taggedReply = '[excited]今天真不错！[laughing]一起出去玩吧！[profile]'
    mocks.generate.mockResolvedValueOnce({
      text: taggedReply,
      model: 'chat',
      provider: 'deepseek',
      durationMs: 1,
      diagnostics: { agentId: 'agent', steps: [], contextMessageCount: 0, toolsAvailable: [], toolsCalled: [] },
    })

    await handleQQMention(params())

    expect(mocks.speech).toHaveBeenCalledWith(expect.objectContaining({ reply: taggedReply }))
    expect(mocks.sendText).toHaveBeenCalledExactlyOnceWith('今天真不错！一起出去玩吧！[profile]')
    expect(mocks.save).toHaveBeenCalledWith(
      'event',
      expect.objectContaining({ text: '今天真不错！一起出去玩吧！[profile]' })
    )
  })

  it('falls back once, keeps the full answer when fallback fails, and never adds a generic error reply', async () => {
    mocks.sendText.mockRejectedValueOnce(new Error('QQ delivery failed'))
    const input = params()
    await handleQQMention(input)
    expect(mocks.sendText).toHaveBeenCalledExactlyOnceWith(reply)
    expect(input.thread.post).not.toHaveBeenCalled()
    expect(mocks.save).toHaveBeenCalledWith(
      'event',
      expect.objectContaining({ text: reply, status: 'failed', errorCode: 'QQ_REPLY_FAILED' })
    )
  })

  it('stops after cancellation and bypasses speech for ordinary text', async () => {
    mocks.speech.mockImplementationOnce(async () => {
      mocks.controller.abort()
      throw mocks.controller.signal.reason
    })
    await handleQQMention(params())
    expect(mocks.sendText).not.toHaveBeenCalled()
    expect(mocks.save).toHaveBeenCalledWith('event', expect.objectContaining({ text: reply, errorCode: 'ABORTED' }))
    mocks.controller = new AbortController()
    mocks.speech.mockClear()
    await handleQQMention(params('你好'))
    expect(mocks.speech).not.toHaveBeenCalled()
    expect(mocks.sendText).toHaveBeenCalledExactlyOnceWith(reply)
  })
})
