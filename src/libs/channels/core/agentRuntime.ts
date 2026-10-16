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

import { llmEnv } from '@/envs/llm'
import { WEB_SEARCH_SYSTEM_INSTRUCTION } from '@/server/chat/toolRegistry'
import { resolveUserWebTools, WEB_FETCH_INSTRUCTION } from '@/server/search/webTools'

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
  baseURL?: string
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
    baseURL: credentials.baseURL ?? (provider === 'openai' ? llmEnv.OPENAI_BASE_URL : undefined),
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
    const { languageModel, settlement, baseURL } = await resolveRuntimeModel(
      params.userId,
      modelId,
      provider,
      params.platform
    )

    const startedAt = Date.now()
    const steps: Array<{ finish: string; resultCount: number; step: number; tools: string[] }> = []
    let result: Awaited<ReturnType<typeof generateText>>
    let generation = params.generation
    try {
      const originalGeneration = params.generation
      const tools = { ...(originalGeneration?.tools as Record<string, unknown> | undefined) }
      const web = Object.hasOwn(tools, 'webSearch')
        ? await resolveUserWebTools({ userId: params.userId, provider, model: modelId, baseURL })
        : null
      if (web?.native) delete tools.webSearch
      generation = web
        ? {
            ...originalGeneration,
            tools: { ...tools, ...web.tools },
            instructions: [
              web.native
                ? originalGeneration?.instructions?.replace(WEB_SEARCH_SYSTEM_INSTRUCTION, '')
                : originalGeneration?.instructions,
              web.native ? '使用 web_search 获取最新资料，回答附上来源 URL。' : WEB_FETCH_INSTRUCTION,
            ]
              .filter(Boolean)
              .join('\n\n'),
          }
        : originalGeneration
      result = await generateText({
        ...(generation as Record<string, unknown> | undefined),
        abortSignal: params.abortSignal,
        instructions: generationInstructions(generation, agent.systemRole),
        messages: generationMessages(params, generation),
        model: languageModel,
        onStepEnd: (event) => {
          const step = event as {
            finishReason?: string
            stepNumber?: number
            toolCalls?: Array<{ toolName: string }>
            toolResults?: unknown[]
          }
          steps.push({
            finish: step.finishReason ?? '-',
            resultCount: step.toolResults?.length ?? 0,
            step: step.stepNumber ?? 0,
            tools: step.toolCalls?.map((call) => call.toolName) ?? [],
          })
          generation?.onStepEnd?.(event)
        },
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
        available: generationToolNames(generation),
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
      diagnostics: {
        agentId: agent.id,
        contextMessageCount: generationMessages(params, params.generation).length,
        finish: result.finishReason,
        steps,
        toolsAvailable: generationToolNames(generation),
        toolsCalled: result.toolCalls?.map((toolCall) => toolCall.toolName) ?? [],
      },
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
