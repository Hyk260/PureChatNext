import { isObjectLike } from '@pure/utils/object'
import { isBailianQwenSpeechModel, QQ_SPEECH_LIMITS, speechVoices, stripQwenTtsTags } from '@pure/const'
import { QQDeliveryError } from '@pure/chat-adapter/qq'
import type { QQAdapter } from '@pure/chat-adapter/qq'
import { ChannelBindingModel } from '@pure/database/models/channelBinding'
import { QQSpeechModel } from '@pure/database/models/qqSpeech'
import { ServiceModelSettingsModel } from '@pure/database/models/serviceModelSettings'
import type { QQSpeechModelReference, ServiceSpeechModelReference } from '@pure/types'

import {
  DEFAULT_QQ_SPEECH_CONFIG,
  SpeechError,
  resolveSpeechCredentials,
  synthesizeSpeech,
} from '@/server/speech'
import { recordChannelGatewayLog } from '@/server/channel-gateway/diagnostics'

import { confirmChannelSpeechIntent } from '../core/agentRuntime'
import { evaluateQQInboundAccess, normalizeQQChannelSettings } from './advancedSettings'
import type { QQThreadType } from './thread'

export type QQReplySender = ReturnType<QQAdapter['createReplySender']>

function toSpeechSynthesisConfig(config: QQSpeechModelReference): ServiceSpeechModelReference {
  return {
    model: config.model,
    provider: config.provider,
    ...(config.voice ? { voice: config.voice } : {}),
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
  }
}

const SPEECH_INTENT_CUES = [
  /(?:语音|发(?:个|一段|条)?语音|语音回复|用语音说|用.{0,6}声音(?:回答|回复)|声音(?:回答|回复))/i,
  /(?:朗读|读(?:出来|一遍|一下|一段|这段|给.{0,6}听)|念(?:出来|一遍|一下|一段|首诗|诗|稿子|给.{0,6}听)|播报|说给.{0,6}听)/i,
  /(?:听(?:我|你|他|她|它|机器人|助手)?(?:说话|讲话|说|讲)|听.{0,5}声音|让我听|想听)/i,
  /(?:唱(?:歌|一首|首歌|给.{0,6}听)?|哼(?:歌|唱)?)/i,
  /(?:voice|audio|read\s+(?:it\s+)?aloud|speak|say.{0,12}aloud|sing(?:ing)?|hum(?:ming)?|talk\s+(?:to|with)\s+me|let\s+me\s+hear|i\s+(?:want|wanna|would\s+like)\s+to\s+hear)/i,
] as const

export function isQQSpeechCandidate(
  input: string,
  reply: string,
  replyMode: QQSpeechModelReference['replyMode'] = 'smart'
): boolean {
  if (replyMode === 'never') return false
  const text = reply.trim()
  if (!text || Array.from(text).length > QQ_SPEECH_LIMITS.characters) return false
  if (/```|~~~|`|https?:\/\/|www\.|\[[^\]]*\]\(|\$|\\\(|\\\[|\|.*\||<[^>]+>/i.test(text)) return false
  return replyMode === 'always' || SPEECH_INTENT_CUES.some((cue) => cue.test(input))
}

const terminalQQCodes = new Set([
  'BINDING_ACCESS_CHANGED',
  'QQ_REPLY_EXPIRED',
  'QQ_REPLY_BUDGET',
  'QQ_PASSIVE_CONTEXT_MISSING',
  'QQ_40034128',
  'QQ_850018',
  'QQ_HTTP_401',
])
function terminalCode(error: unknown): string | undefined {
  if (!isObjectLike(error) || !('code' in error)) return undefined
  return typeof error.code === 'string' && terminalQQCodes.has(error.code) ? error.code : undefined
}
export const canFallbackQQSpeech = (error: unknown) => !terminalCode(error)

export async function tryQQSpeech(params: {
  agentId: string
  bindingId: string
  eventId: string
  userId: string
  senderId: string
  threadType: QQThreadType
  input: string
  reply: string
  model: string
  provider: string
  signal: AbortSignal
  sender: QQReplySender
  /** Explicit development command; still uses normal QQ access and speech admission checks. */
  force?: boolean
}): Promise<'sent' | 'text' | 'stopped'> {
  if (!['group', 'c2c'].includes(params.threadType)) return 'text'
  const speechModel = new QQSpeechModel()
  let reserved = false
  let configured: QQSpeechModelReference | undefined
  let stage = 'configuration'
  const signal = AbortSignal.any([params.signal, AbortSignal.timeout(QQ_SPEECH_LIMITS.durationMs)])
  const getSpeechConfig = async (): Promise<QQSpeechModelReference> => {
    const binding = await new ChannelBindingModel().findById(params.bindingId)
    if (binding?.settings?.speechModel) return binding.settings.speechModel
    return (await new ServiceModelSettingsModel().get(params.userId)).qqSpeech ?? DEFAULT_QQ_SPEECH_CONFIG
  }
  const finish = async (state: 'sent' | 'skipped' | 'fallback' | 'failed' | 'cancelled', code: string) => {
    if (reserved) await speechModel.finish(params.eventId, state, code).catch(() => {})
    const speechSupportsInstruction = configured
      ? isBailianQwenSpeechModel(configured.provider, configured.model)
      : false
    await recordChannelGatewayLog({
      userId: params.userId,
      bindingId: params.bindingId,
      platform: 'qq',
      event: 'speech_result',
      code,
      ...(configured
        ? {
            speechResult: {
              instruction: configured.instruction,
              instructionApplicable: speechSupportsInstruction,
              instructionSent: speechSupportsInstruction && Boolean(configured.instruction?.trim()),
              model: configured.model,
              provider: configured.provider,
              state,
              voice: configured.voice ?? speechVoices(configured.provider, configured.model)[0],
            },
          }
        : { speechResult: { state } }),
    })
  }
  const accessStatus = async (): Promise<'voice' | 'text' | 'stopped'> => {
    if (reserved && !(await speechModel.isPending(params.eventId))) return 'stopped'
    const binding = await new ChannelBindingModel().findById(params.bindingId)
    const allowed =
      binding?.enabled &&
      !binding.needsRebind &&
      binding.userId === params.userId &&
      evaluateQQInboundAccess({
        authorId: params.senderId,
        threadType: params.threadType,
        settings: normalizeQQChannelSettings(binding.settings),
      }).ok
    if (!allowed) return 'stopped'
    const current = await getSpeechConfig()
    if (
      current.provider !== configured?.provider ||
      current.model !== configured.model ||
      current.voice !== configured.voice ||
      current.endpoint !== configured.endpoint ||
      current.replyMode !== configured.replyMode ||
      current.instruction !== configured.instruction
    )
      return 'text'
    return 'voice'
  }
  try {
    params.signal.throwIfAborted()
    configured = await getSpeechConfig()
    const replyMode = configured.replyMode ?? 'smart'
    if (!params.force && !isQQSpeechCandidate(params.input, params.reply, replyMode)) return 'text'
    const supportsQwenTags = isBailianQwenSpeechModel(configured.provider, configured.model)
    if (params.force && !supportsQwenTags) {
      await finish('fallback', 'SPEECH_TAGS_UNSUPPORTED')
      return 'text'
    }
    params.sender.assertAvailable(1)
    const initialAccess = await accessStatus()
    if (initialAccess !== 'voice') return initialAccess
    const credentials = await resolveSpeechCredentials(params.userId, configured)
    signal.throwIfAborted()
    const denied = await speechModel.reserve(params)
    if (denied) {
      await finish('skipped', denied)
      return denied === 'DUPLICATE_ATTEMPT' || denied === 'BINDING_DISABLED' || denied === 'QQ_REPLY_BUDGET'
        ? 'stopped'
        : 'text'
    }
    reserved = true
    if (!params.force && replyMode === 'smart') {
      stage = 'intent'
      const speak = await confirmChannelSpeechIntent({
        agentId: params.agentId,
        userId: params.userId,
        provider: params.provider,
        model: params.model,
        text: params.input,
        signal: AbortSignal.any([signal, AbortSignal.timeout(3_000)]),
      })
      if (!speak) {
        await finish('skipped', 'SPEECH_NOT_REQUESTED')
        return 'text'
      }
    }
    stage = 'synthesis'
    const audio = await synthesizeSpeech({
      config: toSpeechSynthesisConfig(configured),
      credentials,
      ...(supportsQwenTags && configured.instruction ? { instruction: configured.instruction } : {}),
      text: supportsQwenTags ? params.reply : stripQwenTtsTags(params.reply),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    })
    signal.throwIfAborted()
    const deliveryAccess = await accessStatus()
    if (deliveryAccess !== 'voice') {
      await finish('cancelled', deliveryAccess === 'text' ? 'SPEECH_CONFIGURATION_CHANGED' : 'BINDING_ACCESS_CHANGED')
      return deliveryAccess
    }
    stage = 'delivery'
    await params.sender.sendAudio(audio, signal, async () => {
      const currentAccess = await accessStatus()
      if (currentAccess === 'stopped') throw new QQDeliveryError('BINDING_ACCESS_CHANGED', 'not_sent')
      if (currentAccess === 'text') throw new SpeechError('SPEECH_CONFIGURATION_CHANGED')
    })
    await finish('sent', 'SPEECH_SENT')
    return 'sent'
  } catch (error) {
    if (params.signal.aborted) {
      await finish('cancelled', 'SPEECH_CANCELLED')
      params.signal.throwIfAborted()
    }
    const code =
      terminalCode(error) ??
      (error instanceof SpeechError || error instanceof QQDeliveryError
        ? error.code
        : `SPEECH_${stage.toUpperCase()}_FAILED`)
    const fallback =
      canFallbackQQSpeech(error) &&
      (await accessStatus()
        .then((status) => status !== 'stopped')
        .catch(() => false))
    await finish(fallback ? 'fallback' : 'failed', code)
    return fallback ? 'text' : 'stopped'
  }
}
