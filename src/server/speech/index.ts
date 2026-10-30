import debug from 'debug'
import { createOpenAI } from '@ai-sdk/openai'
import { generateSpeech } from 'ai'
import {
  DEFAULT_QQ_SPEECH_CONFIG,
  isBailianQwenSpeechModel,
  isBuiltinProviderId,
  QQ_SPEECH_LIMITS,
  speechConfigError,
  speechVoices,
} from '@pure/const'
import { CustomProviderModel } from '@pure/database/models/customProvider'
import { UserProviderSettingsModel } from '@pure/database/models/userProviderSettings'
import { ssrfSafeFetch } from '@pure/ssrf-safe-fetch'
import type { ServiceSpeechModelReference } from '@pure/types'

import { resolveUserProviderCredentials } from '@/libs/ai-providers/userSecrets'
import type { UserProviderCredentials } from '@/libs/ai-providers/userSecrets'

export { DEFAULT_QQ_SPEECH_CONFIG } from '@pure/const'

const log = debug('channel:core:agent')

export class SpeechError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'SpeechError'
  }
}

export async function resolveSpeechCredentials(
  userId: string,
  config: ServiceSpeechModelReference
): Promise<UserProviderCredentials> {
  if (speechConfigError(config)) throw new SpeechError('SPEECH_CONFIGURATION')
  if (isBuiltinProviderId(config.provider)) {
    const enabled = await new UserProviderSettingsModel().list(userId)
    if (enabled[config.provider] === false) throw new SpeechError('SPEECH_PROVIDER_DISABLED')
  } else {
    const provider = await new CustomProviderModel(userId).find(config.provider)
    if (!provider?.enabled) throw new SpeechError('SPEECH_PROVIDER_UNAVAILABLE')
  }
  const credentials = await resolveUserProviderCredentials({
    userId,
    provider: config.provider,
    allowEnvFallback: false,
  })
  if (!credentials) throw new SpeechError('SPEECH_CREDENTIALS_MISSING')
  return credentials
}

export function validateSpeechAudio(audio: Uint8Array): Buffer {
  if (!audio.length || audio.length > QQ_SPEECH_LIMITS.bytes) throw new SpeechError('SPEECH_AUDIO_SIZE')
  const mp3 =
    (audio[0] === 0x49 && audio[1] === 0x44 && audio[2] === 0x33) || (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0)
  if (!mp3) throw new SpeechError('SPEECH_AUDIO_FORMAT')
  return Buffer.from(audio)
}

function synthesisHttpErrorCode(status: number): string {
  if (status === 429) return 'SPEECH_RATE_LIMIT'
  if (status >= 400 && status < 600) return `SPEECH_HTTP_${status}`
  return 'SPEECH_SYNTHESIS_FAILED'
}

export async function synthesizeSpeech(params: {
  config: ServiceSpeechModelReference
  credentials: UserProviderCredentials
  instruction?: string
  text: string
  signal: AbortSignal
}): Promise<Buffer> {
  const { config, credentials, instruction, signal, text } = params
  const voice = config.voice ?? speechVoices(config.provider, config.model)[0]
  signal.throwIfAborted()
  if (config.provider === 'bailian') {
    const baseURL = (credentials.baseURL || 'https://dashscope.aliyuncs.com/api/v1')
      .replace(/\/compatible-mode\/v1\/?$/, '/api/v1')
      .replace(/\/+$/, '')
    const endpoint = config.endpoint ?? `${baseURL}/services/audio/tts/SpeechSynthesizer`
    const input = {
      text,
      voice,
      format: 'mp3',
      sample_rate: 24000,
      ...(instruction?.trim() && isBailianQwenSpeechModel(config.provider, config.model)
        ? { instruction: instruction.trim() }
        : {}),
    }
    log('speech synthesis input provider=%s model=%s input=%O', config.provider, config.model, input)
    const response = await ssrfSafeFetch(
      endpoint,
      {
        method: 'POST',
        redirect: 'error',
        signal,
        headers: { Authorization: `Bearer ${credentials.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model, input }),
      },
      { maxContentLength: 128 * 1024, redactErrors: true }
    )
    if (!response.ok) throw new SpeechError(synthesisHttpErrorCode(response.status))
    const result = (await response.json()) as { output?: { audio?: { url?: unknown } } }
    const url = result.output?.audio?.url
    if (typeof url !== 'string' || !url) throw new SpeechError('SPEECH_AUDIO_MISSING')
    const audio = await ssrfSafeFetch(
      url,
      { signal, redirect: 'error' },
      { maxContentLength: QQ_SPEECH_LIMITS.bytes + 1, redactErrors: true }
    )
    if (!audio.ok) throw new SpeechError('SPEECH_DOWNLOAD_FAILED')
    const resultAudio = validateSpeechAudio(new Uint8Array(await audio.arrayBuffer()))
    logSpeechOutput(config, resultAudio)
    return resultAudio
  }
  const client = createOpenAI({
    apiKey: credentials.apiKey,
    baseURL: credentials.baseURL || 'https://api.openai.com/v1',
    fetch: async (input, init) => {
      const request = new Request(input, init)
      return ssrfSafeFetch(
        request.url,
        {
          method: request.method,
          headers: request.headers,
          redirect: 'error',
          signal,
          body: request.body ? await request.arrayBuffer() : undefined,
        },
        { maxContentLength: QQ_SPEECH_LIMITS.bytes + 1, redactErrors: true }
      )
    },
  })
  const input = { text, voice, outputFormat: 'mp3' as const }
  log('speech synthesis input provider=%s model=%s input=%O', config.provider, config.model, {
    model: config.model,
    ...input,
  })
  const result = await generateSpeech({
    model: client.speech(config.model),
    ...input,
    abortSignal: signal,
    maxRetries: 0,
  })
  const resultAudio = validateSpeechAudio(result.audio.uint8Array)
  logSpeechOutput(config, resultAudio)
  return resultAudio
}

function logSpeechOutput(config: ServiceSpeechModelReference, audio: Buffer): void {
  log('speech synthesis output provider=%s model=%s output=%O', config.provider, config.model, {
    byteLength: audio.byteLength,
    format: 'mp3',
  })
}
