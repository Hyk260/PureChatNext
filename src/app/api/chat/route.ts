import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { createOpenAI } from '@ai-sdk/openai'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { PURECHAT_PROVIDER_ID } from '@pure/const'
import { getAiModel } from '@pure/model-bank'
import { loadFile } from '@pure/file-loaders'
import { CreditsModel, FreePlanLimitError } from '@pure/database/models/credits'
import { CHAT_PERMISSION_MODES } from '@pure/types'
import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream } from 'ai'
import type { ToolExecutionEndEvent, ToolSet, UIMessage } from 'ai'
import debug from 'debug'
import { createNanoId } from '@pure/utils'

import { isSupportedProviderId } from '@/libs/ai-providers/resolveClient'
import { MISSING_USER_PROVIDER_SECRET_MESSAGE, resolveUserProviderCredentials } from '@/libs/ai-providers/userSecrets'
import { getAuthenticatedUserId } from '@/libs/auth/get-session-user'
import { ChatSDKError } from '@/libs/errors'
import { llmEnv, resolveAiGatewayApiKey, resolveAiGatewayBaseURL } from '@/envs/llm'
import { toolsEnv } from '@/envs/tools'
import {
  computeChatCost,
  getEnabledPureChatModel,
  getPureChatModel,
  getShanghaiBillingPeriod,
  PURECHAT_DEFAULT_MODEL,
  resolvePureChatGatewayId,
} from '@/server/purechat'
import {
  getPureChatStreamErrorMessage,
  getPublicGatewayErrorMessage,
  isPureChatRestrictedModelError,
  PURECHAT_MODEL_UNAVAILABLE_MESSAGE,
} from '@/server/purechat/gatewayError'
import { buildChatRuntimeInstructions } from '@/server/chat/runtimeInstructions'
import { resolveChatToolInstructions, resolveChatTools } from '@/server/chat/toolRegistry'
import { desktopTools } from '@/server/chat/desktopTools'
import { CHAT_TOOL_CAPABILITIES, isToolApprovalRequired } from '@/server/chat/permissionPolicy'

import { createMessageMetadata } from './messageMetadata'

export const maxDuration = 60

const log = debug('chat:route')
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const MAX_ATTACHMENTS = 8
const MAX_EXTRACTED_CHARS = 40_000
const DESKTOP_CLIENT_INSTRUCTION =
  '桌面本地工具只可通过客户端执行；先说明计划并等待必要的用户审批，不要重复尝试被拒绝的调用。'
const RATE_LIMIT_PUBLIC_MESSAGE = '上游限流，请稍后重试。'

type ChatPermissionMode = (typeof CHAT_PERMISSION_MODES)[number]

type ChatRequestBody = {
  baseURL?: string
  messages: UIMessage[]
  modelAbilities?: { vision?: boolean }
  model?: string
  clientCapabilities?: { desktop?: boolean }
  topicId?: string
  permissionMode?: unknown
  provider?: string
  searchMode?: unknown
  system?: string
}

type ChatFilePart = Extract<UIMessage['parts'][number], { type: 'file' }> & {
  filename?: string
  name?: string
}

type ToolApprovalCall = { toolCallId?: string; toolName: string; input: unknown }

const dataUrlToBuffer = (url: string) => {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(url)
  if (!match) throw new Error('附件数据格式无效')
  return { buffer: Buffer.from(match[2], 'base64'), mediaType: match[1] }
}

const normalizeAttachmentMessages = async (messages: UIMessage[], supportsVision: boolean): Promise<UIMessage[]> => {
  const attachments = messages.flatMap((message) => message.parts.filter((part) => part.type === 'file'))
  if (attachments.length > MAX_ATTACHMENTS) throw new Error(`最多支持 ${MAX_ATTACHMENTS} 个附件`)

  const tempPaths: string[] = []
  try {
    return await Promise.all(
      messages.map(async (message) => {
        const parts: UIMessage['parts'] = []
        for (const part of message.parts) {
          if (part.type !== 'file') {
            parts.push(part)
            continue
          }

          const filePart = part as ChatFilePart
          const filename = filePart.filename ?? filePart.name ?? 'attachment'
          const { buffer, mediaType } = dataUrlToBuffer(part.url)
          if (buffer.byteLength > MAX_ATTACHMENT_BYTES) throw new Error(`附件「${filename}」超过 10MB 限制`)
          if (mediaType.startsWith('image/')) {
            if (!supportsVision) throw new Error('当前模型不支持图片理解')
            parts.push({ ...part, mediaType })
            continue
          }

          const tempPath = join(tmpdir(), `chat-file-${randomUUID()}-${filename}`)
          tempPaths.push(tempPath)
          await writeFile(tempPath, buffer)
          const document = await loadFile(tempPath, { filename, source: tempPath })
          const extracted = document.content.slice(0, MAX_EXTRACTED_CHARS)
          parts.push({ type: 'text', text: `[附件 ${filename}]\n${extracted}` })
        }
        return { ...message, parts }
      })
    )
  } finally {
    await Promise.all(tempPaths.map((path) => unlink(path).catch(() => {})))
  }
}

/** Prefer Authorization: Bearer <token>; otherwise fall back to provider env keys. */
const resolveApiKeyFromHeader = (request: Request) => {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return undefined

  const token = authHeader.slice('Bearer '.length).trim()
  return token || undefined
}

const resolveProviderOptions = (apiKey: string | undefined, baseURL: string | undefined) => {
  const options: { apiKey?: string; baseURL?: string } = {}
  if (apiKey) options.apiKey = apiKey
  if (baseURL) options.baseURL = baseURL
  return Object.keys(options).length > 0 ? options : undefined
}

const resolveModel = (
  provider: string | undefined,
  model: string | undefined,
  apiKey: string | undefined,
  baseURL: string | undefined
) => {
  const resolvedProvider = provider ?? 'deepseek'
  const resolvedModel = model ?? 'deepseek-v4-flash'
  const options = resolveProviderOptions(apiKey, baseURL)

  switch (resolvedProvider) {
    case PURECHAT_PROVIDER_ID: {
      const gatewayId = resolvePureChatGatewayId(resolvedModel)
      if (!gatewayId) {
        throw new ChatSDKError('bad_request:api', `Unknown PureChat model "${resolvedModel}"`)
      }
      return createOpenAI(options)(gatewayId)
    }
    case 'openai':
      return createOpenAI(options)(resolvedModel)
    case 'deepseek':
    default:
      return createDeepSeek(options)(resolvedModel)
  }
}

const isInvalidClientCapabilities = (value: unknown) => {
  if (value === undefined) return false
  if (!value || typeof value !== 'object') return true
  const desktop = (value as { desktop?: unknown }).desktop
  return desktop !== undefined && typeof desktop !== 'boolean'
}

const resolveToolIdentifier = (toolName: string) =>
  CHAT_TOOL_CAPABILITIES.find((capability) => capability.apiName === toolName)?.identifier ?? 'unknown'

const loadToolApprovalModel = async (userId: string) => {
  const { ChatToolApprovalModel } = await import('@pure/database/models/chatToolApproval')
  return new ChatToolApprovalModel(userId)
}

const createDesktopToolApproval = (context: {
  requestUserId: string | null
  topicId?: string
  topicPermissionMode?: ChatPermissionMode
}) => {
  const { requestUserId, topicId, topicPermissionMode } = context

  return async ({ toolCall }: { toolCall: ToolApprovalCall }) => {
    if (Object.hasOwn(desktopTools, toolCall.toolName)) return undefined

    const input = toolCall.input && typeof toolCall.input === 'object' ? toolCall.input : undefined
    const identifier = resolveToolIdentifier(toolCall.toolName)

    if (requestUserId && topicId && toolCall.toolCallId && input) {
      const approvals = await loadToolApprovalModel(requestUserId)
      await approvals.upsertPending({
        apiName: toolCall.toolName,
        args: input as Record<string, unknown>,
        argsHash: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
        identifier,
        topicId,
        toolCallId: toolCall.toolCallId,
      })
    }

    const capability = isToolApprovalRequired({
      apiName: toolCall.toolName,
      args: input as Record<string, unknown> | undefined,
      identifier,
      mode: topicPermissionMode ?? 'auto',
    })

    if (capability.decision === 'user-approval') return 'user-approval' as const
    if (capability.decision === 'denied') {
      if (requestUserId && topicId && toolCall.toolCallId) {
        const approvals = await loadToolApprovalModel(requestUserId)
        await approvals.updateStatus(topicId, toolCall.toolCallId, 'denied', capability.reason)
      }
      return { reason: capability.reason, type: 'denied' as const }
    }
    return { reason: capability.reason, type: 'approved' as const }
  }
}

const createToolExecutionEndHandler = (userId: string, topicId: string) => {
  return async ({ toolCall, toolOutput }: ToolExecutionEndEvent) => {
    const failed = toolOutput?.type === 'tool-error'
    const approvals = await loadToolApprovalModel(userId)
    await approvals.updateStatus(
      topicId,
      toolCall.toolCallId,
      failed ? 'failed' : 'completed',
      failed ? String(toolOutput.error ?? '工具执行失败') : undefined
    )
  }
}

const buildSearchOptions = ({
  desktopClient,
  requestUserId,
  topicId,
  toolApproval,
  tools,
}: {
  desktopClient: boolean
  requestUserId: string | null
  topicId?: string
  toolApproval: ReturnType<typeof createDesktopToolApproval> | undefined
  tools: ToolSet
}) => {
  if (Object.keys(tools).length === 0) return {}

  return {
    stopWhen: isStepCount(5),
    ...(toolApproval ? { toolApproval } : {}),
    ...(toolsEnv.TOOL_APPROVAL_SECRET ? { experimental_toolApprovalSecret: toolsEnv.TOOL_APPROVAL_SECRET } : {}),
    ...(desktopClient && requestUserId && topicId
      ? { onToolExecutionEnd: createToolExecutionEndHandler(requestUserId, topicId) }
      : {}),
    tools,
  }
}

const chargePureChatUsage = async ({
  cachedInputTokens,
  displayModel,
  inputTokens,
  outputTokens,
  settlementId,
  settlementPeriod,
  usageStartedAt,
  userId,
}: {
  cachedInputTokens: number | undefined
  displayModel: string
  inputTokens: number | undefined
  outputTokens: number | undefined
  settlementId: string
  settlementPeriod: string
  usageStartedAt: number
  userId: string
}) => {
  const cardForCost = getPureChatModel(displayModel)
  if (!cardForCost) return

  if (inputTokens == null && outputTokens == null) {
    log('purechat onEnd: no usage, skip charge')
    return
  }

  const { totalCredits } = computeChatCost(cardForCost.pricing, {
    cachedInputTokens,
    inputTokens,
    outputTokens,
  })

  try {
    const charged = await new CreditsModel().chargeChatUsage({
      cachedInputTokens,
      credits: totalCredits,
      durationMs: Date.now() - usageStartedAt,
      inputTokens,
      messageId: settlementId,
      model: displayModel,
      outputTokens,
      period: settlementPeriod,
      provider: PURECHAT_PROVIDER_ID,
      trigger: 'web',
      userId,
    })
    log('purechat charged: %o', charged)
  } catch (error) {
    log('purechat charge failed: %o', error)
  }
}

const toPureChatErrorResponse = (error: unknown) => {
  log('purechat streamText failed: %o', error)
  if (isPureChatRestrictedModelError(error)) {
    return new ChatSDKError('bad_request:api', PURECHAT_MODEL_UNAVAILABLE_MESSAGE).toResponse()
  }
  // 上游鉴权失败等：不扣积分（尚未 onEnd）
  const publicMessage = getPublicGatewayErrorMessage(error)
  if (publicMessage === RATE_LIMIT_PUBLIC_MESSAGE) {
    return new ChatSDKError('rate_limit:chat', publicMessage).toResponse()
  }
  return new ChatSDKError('bad_request:api', publicMessage).toResponse()
}

/**
 * chat API
 * POST /api/chat
 *
 * PureChat：需登录；使用服务端 AI_GATEWAY_API_KEY；按 usage 扣免费积分。
 * 自配 openai / deepseek：不扣积分；优先账号金库，其次 Authorization Bearer / 服务端 env。
 */
export async function POST(request: Request) {
  let requestBody: ChatRequestBody

  try {
    requestBody = await request.json()
  } catch {
    return new ChatSDKError('bad_request:api').toResponse()
  }

  const { baseURL, model, system, topicId } = requestBody
  let messages = requestBody.messages
  const provider = requestBody.provider

  if (!Array.isArray(messages)) {
    return new ChatSDKError('bad_request:api').toResponse()
  }
  if (isInvalidClientCapabilities(requestBody.clientCapabilities)) {
    return new ChatSDKError('bad_request:api', 'Invalid client capabilities').toResponse()
  }
  if (requestBody.searchMode !== undefined && requestBody.searchMode !== 'off' && requestBody.searchMode !== 'auto') {
    return new ChatSDKError('bad_request:api', 'Invalid search mode').toResponse()
  }
  if (
    requestBody.permissionMode !== undefined &&
    !CHAT_PERMISSION_MODES.includes(requestBody.permissionMode as ChatPermissionMode)
  ) {
    return new ChatSDKError('bad_request:api', 'Invalid permission mode').toResponse()
  }

  const searchMode = requestBody.searchMode === 'auto' ? 'auto' : 'off'
  const desktopClient = requestBody.clientCapabilities?.desktop === true
  let topicPermissionMode = requestBody.permissionMode as ChatPermissionMode | undefined
  let requestUserId: string | null = null

  if (desktopClient) {
    if (!toolsEnv.TOOL_APPROVAL_SECRET) {
      return new ChatSDKError('bad_request:api', 'Desktop approval secret is not configured').toResponse()
    }
    if (!topicId) return new ChatSDKError('bad_request:api', 'Desktop chat requires topicId').toResponse()
    requestUserId = await getAuthenticatedUserId()
    if (!requestUserId) return new ChatSDKError('unauthorized:chat').toResponse()
    const { ChatTopicModel } = await import('@pure/database/models/chatTopic')
    const topic = await new ChatTopicModel(requestUserId).findById(topicId)
    if (!topic) return new ChatSDKError('not_found:chat', 'Topic not found').toResponse()
    topicPermissionMode = topic.permissionMode
    if (requestBody.permissionMode !== undefined && requestBody.permissionMode !== topic.permissionMode) {
      return new ChatSDKError('bad_request:api', 'Permission mode does not match topic').toResponse()
    }
  }

  const supportsVision = Boolean(
    requestBody.modelAbilities?.vision ??
      getAiModel((provider ?? 'deepseek') as 'purechat' | 'deepseek' | 'openai', model ?? '')?.abilities?.vision
  )
  try {
    messages = await normalizeAttachmentMessages(messages, supportsVision)
  } catch (error) {
    const message = error instanceof Error ? error.message : '附件解析失败'
    return new ChatSDKError('bad_request:api', message).toResponse()
  }

  const toolContext = { channel: 'web', searchMode } as const
  const tools = {
    ...resolveChatTools(toolContext),
    ...(desktopClient ? desktopTools : {}),
  }
  const instructionParts = [system?.trim(), buildChatRuntimeInstructions(), ...resolveChatToolInstructions(toolContext)]
  if (desktopClient) instructionParts.push(DESKTOP_CLIENT_INSTRUCTION)
  const instructions = instructionParts.filter(Boolean).join('\n\n')
  const toolApproval = desktopClient
    ? createDesktopToolApproval({ requestUserId, topicId, topicPermissionMode })
    : undefined
  const searchOptions = buildSearchOptions({ desktopClient, requestUserId, topicId, toolApproval, tools })

  const resolvedProvider = provider ?? 'deepseek'
  const isPureChat = resolvedProvider === PURECHAT_PROVIDER_ID

  if (isPureChat) {
    if (!llmEnv.PURECHAT_ENABLED) {
      return new ChatSDKError('bad_request:api', 'PureChat is disabled').toResponse()
    }

    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return new ChatSDKError('unauthorized:chat').toResponse()
    }

    const displayModel = model?.trim() || PURECHAT_DEFAULT_MODEL
    const card = getPureChatModel(displayModel)
    if (!card) {
      return new ChatSDKError('bad_request:api', `Unknown PureChat model "${displayModel}"`).toResponse()
    }
    if (!getEnabledPureChatModel(displayModel)) {
      return new ChatSDKError('bad_request:api', PURECHAT_MODEL_UNAVAILABLE_MESSAGE).toResponse()
    }

    const gatewayKey = resolveAiGatewayApiKey()
    if (!gatewayKey) {
      log('PureChat missing AI_GATEWAY_API_KEY')
      return new ChatSDKError('bad_request:api', 'PureChat temporarily unavailable').toResponse()
    }

    const settlementPeriod = getShanghaiBillingPeriod()
    const settlementId = createNanoId(24)()

    try {
      await new CreditsModel().assertCanChat(userId, settlementPeriod)
    } catch (error) {
      if (error instanceof FreePlanLimitError) {
        return new ChatSDKError('free_plan_limit:chat', error.message).toResponse()
      }
      throw error
    }

    try {
      const usageStartedAt = Date.now()
      const resolvedModel = resolveModel(
        PURECHAT_PROVIDER_ID,
        displayModel,
        gatewayKey,
        resolveAiGatewayBaseURL()
      )

      log('purechat modelId: %o', resolvedModel.modelId)

      const result = streamText({
        messages: await convertToModelMessages(messages),
        model: resolvedModel,
        ...searchOptions,
        instructions,
        async onEnd({ usage }) {
          await chargePureChatUsage({
            cachedInputTokens: usage.inputTokenDetails.cacheReadTokens,
            displayModel,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            settlementId,
            settlementPeriod,
            usageStartedAt,
            userId,
          })
        },
      })

      return createUIMessageStreamResponse({
        stream: toUIMessageStream({
          messageMetadata: createMessageMetadata(displayModel, PURECHAT_PROVIDER_ID),
          onError: getPureChatStreamErrorMessage,
          sendReasoning: true,
          stream: result.stream,
        }),
      })
    } catch (error) {
      return toPureChatErrorResponse(error)
    }
  }

  if (!isSupportedProviderId(resolvedProvider)) {
    return new ChatSDKError('bad_request:api', `Unsupported provider "${resolvedProvider}"`).toResponse()
  }

  const userId = requestUserId ?? (await getAuthenticatedUserId())
  const credentials = await resolveUserProviderCredentials({
    allowEnvFallback: true,
    headerKey: resolveApiKeyFromHeader(request),
    provider: resolvedProvider,
    requestBaseURL: typeof baseURL === 'string' ? baseURL : undefined,
    userId,
  })

  if (!credentials) {
    const message = userId ? MISSING_USER_PROVIDER_SECRET_MESSAGE : `Missing API key for provider "${resolvedProvider}"`
    return new ChatSDKError('bad_request:api', message).toResponse()
  }

  try {
    const resolvedModel = resolveModel(provider, model, credentials.apiKey, credentials.baseURL)

    log('modelId: %o, provider: %o', resolvedModel.modelId, resolvedModel.provider)

    const result = streamText({
      messages: await convertToModelMessages(messages),
      model: resolvedModel,
      ...searchOptions,
      instructions,
    })

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        messageMetadata: createMessageMetadata(model?.trim() || 'deepseek-v4-flash', resolvedProvider),
        sendReasoning: true,
        stream: result.stream,
      }),
    })
  } catch (error) {
    log('streamText failed: %o', error)
    return new ChatSDKError('bad_request:api', getPublicGatewayErrorMessage(error)).toResponse()
  }
}
