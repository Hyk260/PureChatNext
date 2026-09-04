import { generateText } from 'ai'
import type { LanguageModel, ModelMessage } from 'ai'
import debug from 'debug'

import { PURECHAT_PROVIDER_ID } from '@pure/const'
import { AgentModel } from '@pure/database/models/agent'
import {
  createProviderLanguageModel,
  isSupportedProviderId,
  resolveProviderApiKey,
} from '@/libs/ai-providers/resolveClient'
import {
  assertPureChatCanChat,
  chargePureChatGenerateUsage,
  createPureChatLanguageModel,
} from '@/server/purechat'
import type { PureChatSettlement } from '@/server/purechat'
import { isPureChatRestrictedModelError, PURECHAT_MODEL_UNAVAILABLE_MESSAGE } from '@/server/purechat/gatewayError'

import { resolveChannelModelConfig } from './modelResolver'
import type { ChannelAgentRequest, ChannelAgentResponse, ChannelGenerationOptions } from './types'

const log = debug('channel:core:agent')

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

  const apiKey = resolveProviderApiKey(provider, undefined, undefined)
  if (!apiKey) {
    throw new Error(`No API key for provider "${provider}". Set OPENAI_API_KEY or DEEPSEEK_API_KEY for ${platform} replies.`)
  }

  return { languageModel: createProviderLanguageModel(provider, modelId, apiKey, undefined) }
}

async function settlePureChatUsage(params: {
  agentId: string
  durationMs: number
  model: string
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
    const text = result.text?.trim() || '（模型未返回内容）'
    log('reply generated %O', {
      agentId: agent.id,
      aiOutput: text,
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
        userId: params.userId,
      })
    }

    return {
      artifacts: [],
      durationMs,
      model: modelId,
      provider,
      text: text || '（模型未返回内容）',
    }
  }
}

export const channelAgentRuntime = new ChannelAgentRuntime()

export function generateChannelAgentReply(params: ChannelAgentRequest): Promise<ChannelAgentResponse> {
  return channelAgentRuntime.generate(params)
}
