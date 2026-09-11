import { generateText, isStepCount } from 'ai'
import type { LanguageModel, ModelMessage } from 'ai'
import debug from 'debug'

import { PURECHAT_PROVIDER_ID } from '@pure/const'
import { AgentModel } from '@pure/database/models/agent'
import type { CreditUsageTrigger } from '@pure/database/schemas'
import { createProviderLanguageModel, isSupportedProviderId } from '@/libs/ai-providers/resolveClient'
import { MISSING_USER_PROVIDER_SECRET_MESSAGE, resolveUserProviderCredentials } from '@/libs/ai-providers/userSecrets'
import { assertPureChatCanChat, chargePureChatGenerateUsage, createPureChatLanguageModel } from '@/server/purechat'
import type { PureChatSettlement } from '@/server/purechat'
import { isPureChatRestrictedModelError, PURECHAT_MODEL_UNAVAILABLE_MESSAGE } from '@/server/purechat/gatewayError'

import { resolveChannelModelConfig } from './modelResolver'
import { CHANNEL_FINAL_ANSWER_INSTRUCTION, resolveChannelReplyText } from './replyText'
import type { ChannelAgentRequest, ChannelAgentResponse, ChannelGenerationOptions, ChannelPlatform } from './types'

const log = debug('channel:core:agent')

export const CHANNEL_MAX_GENERATION_STEPS = 5
export const CHANNEL_FINAL_ANSWER_STEP = 3

type PrepareStepEvent = {
  initialInstructions?: unknown
  instructions?: unknown
  stepNumber?: number
}

const instructionText = (value: unknown) => (typeof value === 'string' ? value : '')

export function createChannelGenerationControls(
  platform: ChannelPlatform
): Pick<ChannelGenerationOptions, 'onStepEnd' | 'prepareStep' | 'stopWhen'> {
  return {
    onStepEnd: (event) => {
      const step = event as {
        finishReason?: string
        stepNumber?: number
        toolCalls?: Array<{ toolName: string }>
        toolResults?: unknown[]
      }
      log(
        'step platform=%s step=%d finish=%s tools=%s results=%d',
        platform,
        step.stepNumber ?? 0,
        step.finishReason ?? '-',
        step.toolCalls?.map((call) => call.toolName).join(',') || '-',
        step.toolResults?.length ?? 0
      )
    },
    prepareStep: (event) => {
      const step = event as PrepareStepEvent
      const stepNumber = step.stepNumber ?? 0
      if (stepNumber < CHANNEL_FINAL_ANSWER_STEP) return undefined
      if (stepNumber > CHANNEL_FINAL_ANSWER_STEP) {
        return { activeTools: [], toolChoice: 'none' as const }
      }

      const currentInstructions = instructionText(step.instructions) || instructionText(step.initialInstructions)
      return {
        activeTools: [],
        instructions: [currentInstructions, CHANNEL_FINAL_ANSWER_INSTRUCTION].filter(Boolean).join('\n\n'),
        toolChoice: 'none' as const,
      }
    },
    stopWhen: isStepCount(CHANNEL_MAX_GENERATION_STEPS),
  }
}

function generationMessages(params: ChannelAgentRequest, generation?: ChannelGenerationOptions): ModelMessage[] {
  return generation?.messages ?? params.history ?? [{ content: params.text, role: 'user' }]
}

function generationInstructions(generation?: ChannelGenerationOptions, systemRole?: string | null) {
  return [systemRole, generation?.instructions].filter(Boolean).join('\n\n') || undefined
}

function generationToolNames(generation?: ChannelGenerationOptions): string[] {
  if (!generation?.tools || typeof generation.tools !== 'object') return []
  return Object.keys(generation.tools)
}

type RuntimeModel = {
  languageModel: LanguageModel
  settlement?: PureChatSettlement
}

async function resolveRuntimeModel(
  userId: string,
  modelId: string,
  provider: string,
  platform: string
): Promise<RuntimeModel> {
  if (provider === PURECHAT_PROVIDER_ID) {
    const settlement = await assertPureChatCanChat(userId, modelId)
    const languageModel = createPureChatLanguageModel(modelId)
    if (!languageModel) throw new Error('PureChat temporarily unavailable')

    return { languageModel, settlement }
  }

  if (!isSupportedProviderId(provider)) {
    throw new Error(`Channel provider "${provider}" is not supported by the ${platform} gateway`)
  }

  const credentials = await resolveUserProviderCredentials({
    allowEnvFallback: false,
    provider,
    userId,
  })
  if (!credentials) {
    throw new Error(`${MISSING_USER_PROVIDER_SECRET_MESSAGE}（${platform}）`)
  }

  return {
    languageModel: createProviderLanguageModel(provider, modelId, credentials.apiKey, credentials.baseURL),
  }
}

async function settlePureChatUsage(params: {
  agentId: string
  durationMs: number
  model: string
  trigger: CreditUsageTrigger
  result: Awaited<ReturnType<typeof generateText>>
  settlement: PureChatSettlement
  userId: string
}): Promise<void> {
  try {
    await chargePureChatGenerateUsage({
      durationMs: params.durationMs,
      model: params.model,
      result: params.result,
      settlementId: params.settlement.settlementId,
      settlementPeriod: params.settlement.settlementPeriod,
      trigger: params.trigger,
      userId: params.userId,
    })
  } catch (error) {
    log('charge usage failed agent=%s: %O', params.agentId, error)
  }
}

export class ChannelAgentRuntime {
  async generate(params: ChannelAgentRequest): Promise<ChannelAgentResponse> {
    const agent = await new AgentModel(params.userId).findVisibleById(params.agentId)
    if (!agent) throw new Error(`Agent not found: ${params.agentId}`)

    const { model: modelId, provider } = resolveChannelModelConfig({
      channelName: params.platform,
      fallbackProvider: 'deepseek',
      model: params.model,
      provider: params.provider,
    })
    const { languageModel, settlement } = await resolveRuntimeModel(params.userId, modelId, provider, params.platform)

    const startedAt = Date.now()
    let result: Awaited<ReturnType<typeof generateText>>
    try {
      const generation = params.generation
      result = await generateText({
        ...(generation as Record<string, unknown> | undefined),
        abortSignal: params.abortSignal,
        instructions: generationInstructions(generation, agent.systemRole),
        messages: generationMessages(params, generation),
        model: languageModel,
      } as Parameters<typeof generateText>[0])
    } catch (error) {
      if (isPureChatRestrictedModelError(error)) throw new Error(PURECHAT_MODEL_UNAVAILABLE_MESSAGE)
      throw error
    }

    const durationMs = Date.now() - startedAt
    const rawText = result.text ?? ''
    const text = resolveChannelReplyText(rawText, (result.toolCalls?.length ?? 0) > 0)
    log('reply generated %O', {
      agentId: agent.id,
      aiOutput: text,
      ...(rawText !== text ? { rawOutput: rawText.slice(0, 400) } : {}),
      contextMessageCount: generationMessages(params, params.generation).length,
      durationMs,
      model: modelId,
      platform: params.platform,
      provider,
      tools: {
        available: generationToolNames(params.generation),
        called: result.toolCalls?.map((toolCall) => toolCall.toolName) ?? [],
      },
    })

    if (settlement) {
      await settlePureChatUsage({
        agentId: agent.id,
        durationMs,
        model: modelId,
        result,
        settlement,
        trigger: params.trigger,
        userId: params.userId,
      })
    }

    return {
      artifacts: [],
      durationMs,
      model: modelId,
      provider,
      text,
    }
  }
}

export const channelAgentRuntime = new ChannelAgentRuntime()

export function generateChannelAgentReply(params: ChannelAgentRequest): Promise<ChannelAgentResponse> {
  return channelAgentRuntime.generate(params)
}
