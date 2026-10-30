// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QQDeliveryError } from '@pure/chat-adapter/qq'
import { stripQwenTtsTags } from '@pure/const'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  binding: vi.fn(),
  reserve: vi.fn(),
  finish: vi.fn(),
  pending: vi.fn(),
  confirm: vi.fn(),
  credentials: vi.fn(),
  synthesize: vi.fn(),
  log: vi.fn(),
}))
vi.mock('@pure/database/models/serviceModelSettings', () => ({
  ServiceModelSettingsModel: class {
    get = mocks.get
  },
}))
vi.mock('@pure/database/models/channelBinding', () => ({
  ChannelBindingModel: class {
    findById = mocks.binding
  },
}))
vi.mock('@pure/database/models/qqSpeech', () => ({
  QQSpeechModel: class {
    reserve = mocks.reserve
    finish = mocks.finish
    isPending = mocks.pending
  },
}))
vi.mock('@/libs/channels/core/agentRuntime', () => ({ confirmChannelSpeechIntent: mocks.confirm }))
vi.mock('@/server/speech', () => ({
  DEFAULT_QQ_SPEECH_CONFIG: { provider: 'bailian', model: 'qwen-audio-3.1-tts-flash' },
  SpeechError: class extends Error {
    constructor(readonly code: string) {
      super(code)
    }
  },
  resolveSpeechCredentials: mocks.credentials,
  synthesizeSpeech: mocks.synthesize,
}))
vi.mock('@/server/channel-gateway/diagnostics', () => ({ recordChannelGatewayLog: mocks.log }))

import { isQQSpeechCandidate, tryQQSpeech } from '../speech'

function request() {
  return {
    agentId: 'agent',
    bindingId: 'binding',
    eventId: 'event',
    userId: 'owner',
    senderId: 'sender',
    threadType: 'c2c' as const,
    input: '请用语音回复我，你好',
    reply: '你好，今天想聊点什么？',
    model: 'chat',
    provider: 'deepseek',
    signal: new AbortController().signal,
    sender: {
      usedSeq: 0,
      assertAvailable: vi.fn(),
      sendText: vi.fn(),
      sendAudio: vi.fn().mockResolvedValue(undefined),
    },
  }
}

describe('QQ speech reply policy', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.get.mockResolvedValue({ qqSpeech: { provider: 'openai', model: 'tts-1' } })
    mocks.binding.mockResolvedValue({ id: 'binding', userId: 'owner', enabled: true, needsRebind: false, settings: {} })
    mocks.reserve.mockResolvedValue(undefined)
    mocks.finish.mockResolvedValue(undefined)
    mocks.pending.mockResolvedValue(true)
    mocks.confirm.mockResolvedValue(true)
    mocks.credentials.mockResolvedValue({ apiKey: 'key' })
    mocks.synthesize.mockResolvedValue(Buffer.from('ID3-audio'))
    mocks.log.mockResolvedValue(undefined)
  })

  it('only screens current voice-related messages and excludes unsuitable answers', () => {
    expect(isQQSpeechCandidate('你好', '你好')).toBe(false)
    expect(isQQSpeechCandidate('请读给我听', '你好')).toBe(true)
    for (const reply of [
      '字'.repeat(301),
      '```ts\nconst a=1\n```',
      '| 名称 | 内容 |',
      '$a+b$',
      '参考 https://example.com',
      '命令 `pnpm dev`',
    ]) {
      expect(isQQSpeechCandidate('用语音回答', reply)).toBe(false)
    }
  })

  it('sends audio only and keeps the original text outside synthesis metadata', async () => {
    const params = request()
    expect(await tryQQSpeech(params)).toBe('sent')
    expect(params.sender.sendAudio).toHaveBeenCalledWith(
      Buffer.from('ID3-audio'),
      expect.any(AbortSignal),
      expect.any(Function)
    )
    expect(params.sender.sendText).not.toHaveBeenCalled()
    expect(mocks.finish).toHaveBeenCalledWith('event', 'sent', 'SPEECH_SENT')
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ text: params.input, provider: 'deepseek', model: 'chat' })
    )
  })

  it('uses the default Bailian speech model when no model is configured', async () => {
    mocks.get.mockResolvedValue({})
    expect(await tryQQSpeech(request())).toBe('sent')
    expect(mocks.credentials).toHaveBeenCalledWith(
      'owner',
      expect.objectContaining({ provider: 'bailian', model: 'qwen-audio-3.1-tts-flash' })
    )
    expect(mocks.synthesize).toHaveBeenCalledWith(
      expect.objectContaining({ config: { provider: 'bailian', model: 'qwen-audio-3.1-tts-flash' } })
    )
  })

  it('uses the selected Qwen 3.0 model from QQ binding settings', async () => {
    const config = { provider: 'bailian', model: 'qwen-audio-3.0-tts-flash' }
    mocks.binding.mockResolvedValue({
      id: 'binding',
      userId: 'owner',
      enabled: true,
      needsRebind: false,
      settings: { speechModel: config },
    })

    expect(await tryQQSpeech(request())).toBe('sent')
    expect(mocks.credentials).toHaveBeenCalledWith('owner', config)
    expect(mocks.synthesize).toHaveBeenCalledWith(expect.objectContaining({ config }))
  })

  it('passes Qwen tags and the saved instruction through to synthesis', async () => {
    const taggedReply = '[excited]今天的天气真不错！[laughing]我们一起出去玩吧！'
    const config = {
      instruction: '说话嗲一点，御姐音',
      model: 'qwen-audio-3.1-tts-flash',
      provider: 'bailian',
      replyMode: 'always',
      voice: 'anruorou_v3.1',
    }
    mocks.binding.mockResolvedValue({
      id: 'binding',
      userId: 'owner',
      enabled: true,
      needsRebind: false,
      settings: { speechModel: config },
    })

    expect(await tryQQSpeech({ ...request(), reply: taggedReply })).toBe('sent')
    expect(mocks.synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ provider: 'bailian', model: 'qwen-audio-3.1-tts-flash' }),
        instruction: config.instruction,
        text: taggedReply,
      })
    )
  })

  it('direct TTS commands bypass smart intent and keep tagged text with Qwen models', async () => {
    const taggedText = '[excited]今天的天气真不错！[laughing]我们一起出去玩吧！'
    const config = {
      model: 'qwen-audio-3.1-tts-flash',
      provider: 'bailian',
      replyMode: 'never',
    }
    mocks.binding.mockResolvedValue({
      id: 'binding',
      userId: 'owner',
      enabled: true,
      needsRebind: false,
      settings: { speechModel: config },
    })

    expect(await tryQQSpeech({ ...request(), input: `/tts text='${taggedText}'`, reply: taggedText, force: true })).toBe(
      'sent'
    )
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.synthesize).toHaveBeenCalledWith(expect.objectContaining({ text: taggedText }))
  })

  it('does not synthesize tagged direct commands with models that do not support Qwen tags', async () => {
    const params = { ...request(), force: true }
    expect(await tryQQSpeech(params)).toBe('text')
    expect(mocks.credentials).not.toHaveBeenCalled()
    expect(mocks.synthesize).not.toHaveBeenCalled()
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'speech_result', code: 'SPEECH_TAGS_UNSUPPORTED' })
    )
  })

  it('strips Qwen tags and omits instructions for non-Qwen speech models', async () => {
    const config = {
      instruction: '不要传给 OpenAI',
      model: 'tts-1',
      provider: 'openai',
      replyMode: 'always',
    }
    mocks.binding.mockResolvedValue({
      id: 'binding',
      userId: 'owner',
      enabled: true,
      needsRebind: false,
      settings: { speechModel: config },
    })

    expect(await tryQQSpeech({ ...request(), reply: '[excited]你好 [profile]！[laughing]' })).toBe('sent')
    expect(mocks.synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ provider: 'openai', model: 'tts-1' }),
        text: '你好 [profile]！',
      })
    )
    expect(mocks.synthesize.mock.calls[0][0]).not.toHaveProperty('instruction')
  })

  it('strips only known Qwen tags from text replies', () => {
    expect(stripQwenTtsTags('[excited]天气不错！[laughing][custom]保持 [方括号]')).toBe('天气不错！[custom]保持 [方括号]')
  })

  it('falls back to text when default provider credentials are unavailable', async () => {
    mocks.get.mockResolvedValue({})
    mocks.credentials.mockRejectedValue(new Error('missing'))
    expect(await tryQQSpeech(request())).toBe('text')
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.synthesize).not.toHaveBeenCalled()
  })

  it.each(['不要用语音回复', '他说“用语音回复”，这是什么意思？', '如何实现语音回复？'])(
    'lets semantic confirmation reject %s',
    async (input) => {
      mocks.confirm.mockResolvedValue(false)
      expect(await tryQQSpeech({ ...request(), input })).toBe('text')
      expect(mocks.synthesize).not.toHaveBeenCalled()
      expect(mocks.reserve).toHaveBeenCalledOnce()
    }
  )

  it('charges admission before classification and skips duplicate/limited attempts', async () => {
    mocks.reserve.mockResolvedValueOnce('SENDER_RATE_LIMIT').mockResolvedValueOnce('DUPLICATE_ATTEMPT')
    expect(await tryQQSpeech(request())).toBe('text')
    expect(await tryQQSpeech(request())).toBe('stopped')
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.synthesize).not.toHaveBeenCalled()
  })

  it('does not invoke paid services when unauthorized or without a fallback slot', async () => {
    mocks.binding
      .mockResolvedValueOnce({ userId: 'owner', enabled: false })
      .mockResolvedValueOnce({ userId: 'owner', enabled: false })
    expect(await tryQQSpeech(request())).toBe('stopped')
    const params = request()
    params.sender.assertAvailable.mockImplementation(() => {
      throw new QQDeliveryError('QQ_REPLY_BUDGET', 'not_sent')
    })
    expect(await tryQQSpeech(params)).toBe('stopped')
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.synthesize).not.toHaveBeenCalled()
  })

  it('applies the existing QQ allowlist before resolving paid speech credentials', async () => {
    mocks.binding.mockResolvedValue({ userId: 'owner', enabled: true, settings: { dmPolicy: 'allowlist', allowedUsers: [] } })
    expect(await tryQQSpeech(request())).toBe('stopped')
    expect(mocks.credentials).not.toHaveBeenCalled()
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  it('falls back for missing keys, invalid intent, synthesis and uncertain delivery errors', async () => {
    mocks.credentials.mockRejectedValueOnce(new Error('missing'))
    expect(await tryQQSpeech(request())).toBe('text')
    mocks.confirm.mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'))
    expect(await tryQQSpeech(request())).toBe('text')
    mocks.synthesize.mockRejectedValueOnce(new Error('upstream contains secret URL'))
    expect(await tryQQSpeech(request())).toBe('text')
    const params = request()
    params.sender.sendAudio.mockRejectedValueOnce(new QQDeliveryError('QQ_DELIVERY_UNKNOWN', 'unknown'))
    expect(await tryQQSpeech(params)).toBe('text')
    expect(params.sender.sendAudio).toHaveBeenCalledOnce()
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain('secret URL')
  })

  it('rechecks permission after synthesis and does not fall back when muted', async () => {
    mocks.binding
      .mockResolvedValueOnce({ userId: 'owner', enabled: true, settings: {} })
      .mockResolvedValueOnce({ userId: 'owner', enabled: false })
    const revoked = request()
    expect(await tryQQSpeech(revoked)).toBe('stopped')
    expect(revoked.sender.sendAudio).not.toHaveBeenCalled()
    const muted = request()
    muted.sender.sendAudio.mockRejectedValueOnce(new QQDeliveryError('QQ_850018', 'rejected'))
    expect(await tryQQSpeech(muted)).toBe('stopped')
  })

  it('honors a cross-instance stop and an active /stop without text fallback', async () => {
    mocks.pending.mockResolvedValueOnce(false)
    expect(await tryQQSpeech(request())).toBe('stopped')
    const controller = new AbortController()
    mocks.confirm.mockImplementationOnce(async () => {
      controller.abort()
      throw controller.signal.reason
    })
    const params = { ...request(), signal: controller.signal }
    await expect(tryQQSpeech(params)).rejects.toMatchObject({ name: 'AbortError' })
    expect(params.sender.sendAudio).not.toHaveBeenCalled()
  })

  it('does not deliver after the owner clears the speech configuration during synthesis', async () => {
    const configured = { qqSpeech: { provider: 'openai', model: 'tts-1' } }
    mocks.get.mockResolvedValueOnce(configured).mockResolvedValueOnce(configured).mockResolvedValueOnce({})
    const params = request()
    expect(await tryQQSpeech(params)).toBe('text')
    expect(params.sender.sendAudio).not.toHaveBeenCalled()
  })

  it('does not send a text fallback when access was revoked during a failing synthesis', async () => {
    mocks.synthesize.mockImplementationOnce(async () => {
      mocks.binding.mockResolvedValue({ userId: 'owner', enabled: false })
      throw new Error('upstream failed')
    })
    expect(await tryQQSpeech(request())).toBe('stopped')
  })

  it('bounds a stalled synthesis and falls back without retrying', async () => {
    vi.useFakeTimers()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), milliseconds)
      return controller.signal
    })
    try {
      mocks.synthesize.mockImplementationOnce(
        ({ signal }: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), { once: true })
          })
      )
      const params = request()
      const delivery = tryQQSpeech(params)
      await vi.advanceTimersByTimeAsync(15_001)
      expect(await delivery).toBe('text')
      expect(mocks.synthesize).toHaveBeenCalledOnce()
      expect(params.sender.sendAudio).not.toHaveBeenCalled()
    } finally {
      timeout.mockRestore()
      vi.useRealTimers()
    }
  })
})
