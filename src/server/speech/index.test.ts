// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QQ_SPEECH_LIMITS, QWEN_SPEECH_MODEL_3_0, speechConfigError } from '@pure/const'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), credentials: vi.fn(), enabled: vi.fn(), custom: vi.fn() }))
vi.mock('@pure/ssrf-safe-fetch', () => ({ ssrfSafeFetch: mocks.fetch }))
vi.mock('@/libs/ai-providers/userSecrets', () => ({ resolveUserProviderCredentials: mocks.credentials }))
vi.mock('@pure/database/models/userProviderSettings', () => ({
  UserProviderSettingsModel: class {
    list = mocks.enabled
  },
}))
vi.mock('@pure/database/models/customProvider', () => ({
  CustomProviderModel: class {
    find = mocks.custom
  },
}))

import { resolveSpeechCredentials, synthesizeSpeech, validateSpeechAudio } from './index'

const audio = Buffer.from('ID3-test-audio')
const config = {
  provider: 'bailian',
  model: 'qwen-audio-3.1-tts-flash',
  voice: 'longanhuan_v3.1',
  endpoint: 'https://workspace.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer',
}
const credentials = { apiKey: 'test-key', baseURL: '' }

describe('speech provider boundary', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.enabled.mockResolvedValue({})
    mocks.credentials.mockResolvedValue(credentials)
  })

  it('uses only the current owner BYOK key and rejects disabled or missing credentials', async () => {
    await expect(resolveSpeechCredentials('owner', config)).resolves.toEqual(credentials)
    expect(mocks.credentials).toHaveBeenCalledWith({ userId: 'owner', provider: 'bailian', allowEnvFallback: false })
    mocks.enabled.mockResolvedValue({ bailian: false })
    await expect(resolveSpeechCredentials('owner', config)).rejects.toMatchObject({ code: 'SPEECH_PROVIDER_DISABLED' })
    mocks.enabled.mockResolvedValue({})
    mocks.credentials.mockResolvedValue(null)
    await expect(resolveSpeechCredentials('owner', config)).rejects.toMatchObject({
      code: 'SPEECH_CREDENTIALS_MISSING',
    })
  })

  it('requires an owned enabled custom provider and a supported model/voice/endpoint', async () => {
    mocks.custom.mockResolvedValue(null)
    await expect(
      resolveSpeechCredentials('owner', { provider: 'custom-tts', model: 'voice-model' })
    ).rejects.toMatchObject({ code: 'SPEECH_PROVIDER_UNAVAILABLE' })
    expect(speechConfigError({ ...config, voice: 'alloy' })).toBeTruthy()
    expect(speechConfigError({ ...config, endpoint: 'http://localhost/tts' })).toBeTruthy()
    expect(speechConfigError({ ...config, endpoint: `${config.endpoint}?key=secret` })).toBeTruthy()
    expect(speechConfigError({ provider: 'deepseek', model: 'tts-1' })).toBeTruthy()
    expect(speechConfigError({ provider: 'bailian', model: 'qwen-audio-3.1-tts-flash' })).toBeUndefined()
    expect(speechConfigError({ provider: 'bailian', model: QWEN_SPEECH_MODEL_3_0 })).toBeUndefined()
    expect(
      speechConfigError({ provider: 'bailian', model: QWEN_SPEECH_MODEL_3_0, voice: 'longanhuan_v3.1' })
    ).toBeTruthy()
  })

  it('calls native Bailian HTTP and downloads bounded audio without forwarding authorization', async () => {
    const url = 'https://audio.example/reply.mp3?signature=test'
    mocks.fetch
      .mockResolvedValueOnce(Response.json({ output: { audio: { url } } }))
      .mockResolvedValueOnce(new Response(audio))
    await expect(
      synthesizeSpeech({
        config,
        credentials,
        instruction: '说话嗲一点，御姐音',
        text: '[excited]今天的天气真不错！[laughing]我们一起出去玩吧！',
        signal: new AbortController().signal,
      })
    ).resolves.toEqual(audio)
    const [endpoint, init] = mocks.fetch.mock.calls[0]
    expect(endpoint).toBe(config.endpoint)
    expect(JSON.parse(init.body)).toMatchObject({
      model: config.model,
      input: {
        voice: config.voice,
        format: 'mp3',
        instruction: '说话嗲一点，御姐音',
        text: '[excited]今天的天气真不错！[laughing]我们一起出去玩吧！',
      },
    })
    expect(mocks.fetch.mock.calls[1]).toEqual([
      url,
      expect.not.objectContaining({ headers: expect.anything() }),
      { maxContentLength: QQ_SPEECH_LIMITS.bytes + 1, redactErrors: true },
    ])
  })

  it('builds the default Bailian speech endpoint from provider base URL', async () => {
    mocks.fetch
      .mockResolvedValueOnce(Response.json({ output: { audio: { url: 'https://audio.example/reply.mp3' } } }))
      .mockResolvedValueOnce(new Response(audio))
    await expect(
      synthesizeSpeech({
        config: { provider: 'bailian', model: 'qwen-audio-3.1-tts-flash' },
        credentials: { ...credentials, baseURL: 'https://workspace.cn-beijing.maas.aliyuncs.com/api/v1/' },
        instruction: '  \t',
        text: '你好',
        signal: new AbortController().signal,
      })
    ).resolves.toEqual(audio)
    expect(mocks.fetch.mock.calls[0][0]).toBe(
      'https://workspace.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer'
    )
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).input).not.toHaveProperty('instruction')
  })

  it('uses a Qwen 3.0 compatible default voice', async () => {
    mocks.fetch
      .mockResolvedValueOnce(Response.json({ output: { audio: { url: 'https://audio.example/reply.mp3' } } }))
      .mockResolvedValueOnce(new Response(audio))
    await synthesizeSpeech({
      config: { provider: 'bailian', model: QWEN_SPEECH_MODEL_3_0 },
      credentials: { ...credentials, baseURL: 'https://workspace.cn-beijing.maas.aliyuncs.com/api/v1' },
      text: '你好',
      signal: new AbortController().signal,
    })
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toMatchObject({
      model: QWEN_SPEECH_MODEL_3_0,
      input: { voice: 'longanfengyue', format: 'mp3', text: '你好' },
    })
  })

  it('converts the Bailian chat-compatible base URL to the native API URL', async () => {
    mocks.fetch
      .mockResolvedValueOnce(Response.json({ output: { audio: { url: 'https://audio.example/reply.mp3' } } }))
      .mockResolvedValueOnce(new Response(audio))
    await synthesizeSpeech({
      config: { provider: 'bailian', model: 'qwen-audio-3.1-tts-flash' },
      credentials: { ...credentials, baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
      text: '你好',
      signal: new AbortController().signal,
    })
    expect(mocks.fetch.mock.calls[0][0]).toBe('https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer')
  })

  it('uses the installed AI SDK for OpenAI-compatible speech', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(audio, { headers: { 'content-type': 'audio/mpeg' } }))
    await expect(
      synthesizeSpeech({
        config: { provider: 'openai', model: 'tts-1' },
        credentials,
        instruction: 'should not be sent to OpenAI',
        text: '你好',
        signal: new AbortController().signal,
      })
    ).resolves.toEqual(audio)
    expect(mocks.fetch.mock.calls[0][0]).toBe('https://api.openai.com/v1/audio/speech')
    expect(JSON.parse(new TextDecoder().decode(mocks.fetch.mock.calls[0][1].body))).toMatchObject({
      model: 'tts-1',
      voice: 'alloy',
      response_format: 'mp3',
    })
    expect(JSON.parse(new TextDecoder().decode(mocks.fetch.mock.calls[0][1].body))).not.toHaveProperty('instruction')
  })

  it('rejects rate limits, missing audio, empty/oversized files and non-MP3 data', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response('', { status: 429 }))
    await expect(
      synthesizeSpeech({ config, credentials, text: 'hi', signal: new AbortController().signal })
    ).rejects.toMatchObject({ code: 'SPEECH_RATE_LIMIT' })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    mocks.fetch.mockResolvedValueOnce(new Response('', { status: 400 }))
    await expect(
      synthesizeSpeech({ config, credentials, text: 'hi', signal: new AbortController().signal })
    ).rejects.toMatchObject({ code: 'SPEECH_HTTP_400' })
    mocks.fetch.mockResolvedValueOnce(Response.json({ output: {} }))
    await expect(
      synthesizeSpeech({ config, credentials, text: 'hi', signal: new AbortController().signal })
    ).rejects.toMatchObject({ code: 'SPEECH_AUDIO_MISSING' })
    expect(() => validateSpeechAudio(Buffer.alloc(0))).toThrow('SPEECH_AUDIO_SIZE')
    expect(() => validateSpeechAudio(Buffer.alloc(QQ_SPEECH_LIMITS.bytes + 1))).toThrow('SPEECH_AUDIO_SIZE')
    expect(() => validateSpeechAudio(Buffer.from('<html>error</html>'))).toThrow('SPEECH_AUDIO_FORMAT')
  })
})
