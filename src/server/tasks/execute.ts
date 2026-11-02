import { generateText, isStepCount } from 'ai'
import type { LanguageModel } from 'ai'
import debug from 'debug'
import { PURECHAT_PROVIDER_ID } from '@pure/const'
import type { TaskRunSnapshot } from '@pure/types'

import {
  createOpenAICompatibleLanguageModel,
  createProviderLanguageModel,
  isSupportedProviderId,
} from '@/libs/ai-providers/resolveClient'
import { resolveUserProviderCredentials } from '@/libs/ai-providers/userSecrets'
import { sanitizeChannelReplyText } from '@/libs/channels/core/replyText'
import {
  resolveChatToolInstructions,
  resolveChatTools,
  WEB_SEARCH_SYSTEM_INSTRUCTION,
} from '@/server/chat/toolRegistry'
import {
  assertPureChatCanChat,
  chargePureChatGenerateUsage,
  createPureChatLanguageModel,
} from '@/server/purechat/runtime'
import type { PureChatSettlement } from '@/server/purechat/runtime'
import { resolveUserWebTools, WEB_FETCH_INSTRUCTION } from '@/server/search/webTools'
import { TaskServiceError } from './errors'

const log = debug('tasks:execute')

const isFailedWebSearch = (value: unknown): value is { error: string; success: false } =>
  typeof value === 'object' &&
  value !== null &&
  'success' in value &&
  value.success === false &&
  'error' in value &&
  typeof value.error === 'string'

async function taskModel(
  userId: string,
  snapshot: TaskRunSnapshot
): Promise<{
  baseURL?: string
  model: LanguageModel
  settlement?: PureChatSettlement
}> {
  if (snapshot.provider === 'lmstudio') throw new TaskServiceError('LM Studio 仅支持桌面端聊天，不能用于云端任务')
  if (snapshot.provider === PURECHAT_PROVIDER_ID) {
    const settlement = await assertPureChatCanChat(userId, snapshot.model)
    const model = createPureChatLanguageModel(snapshot.model)
    if (!model) throw new TaskServiceError('PureChat 模型暂不可用')
    return { model, settlement }
  }
  const credentials = await resolveUserProviderCredentials({
    allowEnvFallback: false,
    provider: snapshot.provider,
    userId,
  })
  if (!credentials) throw new TaskServiceError('云端模型密钥缺失，请在服务商设置中重新保存 API Key')
  if (isSupportedProviderId(snapshot.provider)) {
    return {
      baseURL: credentials.baseURL,
      model: createProviderLanguageModel(snapshot.provider, snapshot.model, credentials.apiKey, credentials.baseURL),
    }
  }
  if (!credentials.baseURL) throw new TaskServiceError('自定义服务商缺少服务器可访问的接口地址')
  return {
    baseURL: credentials.baseURL,
    model: createOpenAICompatibleLanguageModel(snapshot.model, credentials.apiKey, credentials.baseURL),
  }
}

export async function executeTask(userId: string, snapshot: TaskRunSnapshot, signal: AbortSignal) {
  const runtime = await taskModel(userId, snapshot)
  const context = { channel: 'automation' as const, searchMode: 'auto' as const, userId }
  const tools = resolveChatTools(context)
  const web = await resolveUserWebTools({
    userId,
    provider: snapshot.provider,
    model: snapshot.model,
    baseURL: runtime.baseURL,
  })
  if (web.native) delete tools.webSearch
  const toolInstructions = resolveChatToolInstructions(context).filter(
    (instruction) => !web.native || instruction !== WEB_SEARCH_SYSTEM_INSTRUCTION
  )
  const localTime = new Date().toLocaleString('zh-CN', { timeZone: snapshot.schedule.timezone, hour12: false })
  const instructions = [
    snapshot.systemRole,
    `当前时间：${localTime}（${snapshot.schedule.timezone}）。这是一次独立的云端定时任务。`,
    '按任务指令执行并直接给出结果。可使用联网搜索和天气工具；没有本机文件或终端能力。消息推送由系统负责，不要自行发送通知。',
    ...toolInstructions,
    web.native ? '需要最新资料时使用 web_search，回答附上来源 URL。' : WEB_FETCH_INSTRUCTION,
  ]
    .filter(Boolean)
    .join('\n\n')
  const startedAt = Date.now()
  const result = await generateText({
    abortSignal: signal,
    instructions,
    maxRetries: 0,
    model: runtime.model,
    messages: [{ role: 'user', content: snapshot.instruction || snapshot.title }],
    prepareStep: ({ stepNumber }) => (stepNumber >= 3 ? { activeTools: [], toolChoice: 'none' as const } : undefined),
    stopWhen: isStepCount(5),
    tools: { ...tools, ...web.tools },
  })
  let billingWarning = false
  if (runtime.settlement) {
    try {
      await chargePureChatGenerateUsage({
        ...runtime.settlement,
        durationMs: Date.now() - startedAt,
        model: snapshot.model,
        result,
        trigger: 'automation',
        userId,
      })
    } catch {
      billingWarning = true
      log('usage settlement unavailable user=%s', userId)
    }
  }
  const failedSearch = result.toolResults.find(
    (toolResult) => toolResult.toolName === 'webSearch' && isFailedWebSearch(toolResult.output)
  )
  if (failedSearch && isFailedWebSearch(failedSearch.output)) throw new TaskServiceError(failedSearch.output.error)

  const text = sanitizeChannelReplyText(result.text ?? '')
  if (!text) throw new TaskServiceError('模型没有生成可读结果，请调整任务说明或更换模型')
  return {
    result: text,
    diagnostics: {
      billingWarning,
      durationMs: Date.now() - startedAt,
      finishReason: result.finishReason,
      usage: result.usage,
      steps: result.steps.map((step) => ({
        finishReason: step.finishReason,
        tools: step.toolCalls.map((call) => call.toolName),
      })),
    },
  }
}
