import { isObjectLike } from '@pure/utils/object'
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  generateText,
  isStepCount,
  streamText,
  toUIMessageStream,
} from 'ai'
import type { UIMessage } from 'ai'
import type { ChatAdvancedSettings, ChatContextSummary, ChatPermissionMode, ServiceModelReference } from '@pure/types'

import { createMessageMetadata } from '@/app/api/chat/messageMetadata'
import { applyInputTemplate, chatAdvancedSettingsSchema, chatContextSummarySchema, selectChatHistory } from '@/features/chat/advancedSettings'
import { getDesktopApi } from '@/types/desktop'
import { createLmStudioModel, getLmStudioMessagesText } from '@/libs/ai-providers/lmstudio'
import type { LmStudioRuntimeConfig } from '@/libs/ai-providers/lmstudio'
import { desktopTools } from '@/server/chat/desktopTools'
import { isToolApprovalRequired } from '@/server/chat/permissionPolicy'

const MAX_MESSAGES = 200
const LOCAL_REQUEST_TIMEOUT_MS = 10 * 60 * 1000

export type LmStudioChatInput = {
  advancedSettings?: ChatAdvancedSettings
  compressionModel?: ServiceModelReference
  contextSummary?: ChatContextSummary
  messages: UIMessage[]
  model: string
  modelContextWindow?: number
  permissionMode?: ChatPermissionMode
  providerId: string
  system?: string
}

const estimateContextTokens = (messages: UIMessage[]) => {
  let textCharacters = 0
  let imageCount = 0
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === 'text') textCharacters += part.text.length
      else if (part.type === 'file' && part.mediaType.startsWith('image/')) imageCount += 1
      else textCharacters += JSON.stringify(part).length
    }
  }
  return Math.ceil(textCharacters / 4) + imageCount * 1024
}

const hashContextMessages = async (messages: UIMessage[]) => {
  const serialized = JSON.stringify(messages.map(({ id, role, parts }) => ({ id, role, parts })))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const createContextSummary = async (messages: UIMessage[], text: string): Promise<ChatContextSummary> => ({
  messageCount: messages.length,
  sourceHash: await hashContextMessages(messages),
  text,
})

const createAbortController = (signal: AbortSignal) => {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(new Error('LM Studio 请求超时')),
    LOCAL_REQUEST_TIMEOUT_MS
  )
  const abort = () => controller.abort(signal.reason)
  if (signal.aborted) abort()
  else signal.addEventListener('abort', abort, { once: true })
  return {
    controller,
    dispose: () => {
      clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
    },
  }
}

export async function createLmStudioChatResponse(
  input: LmStudioChatInput,
  config: LmStudioRuntimeConfig,
  requestSignal: AbortSignal
) {
  if (input.messages.length > MAX_MESSAGES) throw new Error('对话消息过多，请减少历史消息后重试')
  if (!input.model.trim() || input.model.length > 256) throw new Error('LM Studio 模型 ID 无效')

  const { controller, dispose } = createAbortController(requestSignal)
  try {
    const model = createLmStudioModel(input.model, config)
    const parsedSettings = chatAdvancedSettingsSchema.safeParse(input.advancedSettings ?? {})
    if (!parsedSettings.success) throw new Error('高级设置无效，请检查历史消息数量和输入模板。')
    const settings = parsedSettings.data
    const source = selectChatHistory(input.messages, settings)
    let messages = applyInputTemplate(source, settings.inputTemplate)
    const contextBudget = input.modelContextWindow
      ? Math.max(1024, Math.floor(input.modelContextWindow * 0.82))
      : undefined
    let contextSummary: ChatContextSummary | undefined
    const providedSummary = chatContextSummarySchema.safeParse(input.contextSummary)
    if (settings.enableContextCompression && input.contextSummary) {
      const sourceHash = providedSummary.success
        ? await hashContextMessages(source.slice(0, providedSummary.data.messageCount))
        : undefined
      if (
        !providedSummary.success ||
        providedSummary.data.messageCount > source.length ||
        sourceHash !== providedSummary.data.sourceHash
      ) {
        throw new Error('会话摘要与当前历史不匹配，请重试。')
      }
      contextSummary = providedSummary.data
      messages = [
        {
          id: `local-summary-${contextSummary.sourceHash.slice(0, 12)}`,
          parts: [{ text: `较早对话摘要：\n${contextSummary.text}`, type: 'text' }],
          role: 'user',
        },
        ...messages.slice(contextSummary.messageCount),
      ]
    }
    if (
      settings.enableContextCompression &&
      !contextSummary &&
      contextBudget &&
      estimateContextTokens(messages) > contextBudget &&
      messages.length > 2
    ) {
      if (input.compressionModel && input.compressionModel.provider !== 'lmstudio') {
        throw new Error('所选云端压缩模型未能为当前历史生成摘要，请重试。')
      }
      const keepCount = Math.min(8, Math.max(2, Math.ceil(messages.length / 2)))
      const olderMessages = messages.slice(0, -keepCount)
      const recentMessages = messages.slice(-keepCount)
      const compressionModel = input.compressionModel
        ? createLmStudioModel(input.compressionModel.model, config)
        : model
      const summary = await generateText({
        abortSignal: controller.signal,
        instructions: '压缩较早的对话历史，保留用户目标、约束、已完成事项和仍待处理问题。只输出摘要。',
        maxOutputTokens: Math.min(
          1200,
          Math.max(256, Math.floor((input.compressionModel?.contextWindowTokens ?? contextBudget) / 16))
        ),
        model: compressionModel,
        prompt: getLmStudioMessagesText(olderMessages),
      })
      contextSummary = await createContextSummary(olderMessages, summary.text.trim())
      messages = [
        {
          id: `local-summary-${contextSummary.sourceHash.slice(0, 12)}`,
          parts: [{ text: `较早对话摘要：\n${contextSummary.text}`, type: 'text' }],
          role: 'user',
        },
        ...recentMessages,
      ]
    }
    if (contextBudget && estimateContextTokens(messages) > contextBudget) {
      throw new Error('当前输入和近期历史超出 LM Studio 模型上下文，请减少附件或历史消息后重试。')
    }

    const desktopAvailable = Boolean(getDesktopApi())
    const tools = desktopAvailable ? desktopTools : undefined
    const modelMessages = await convertToModelMessages(messages, tools ? { tools } : undefined)
    const permissionMode = input.permissionMode ?? 'auto'
    const result = streamText({
      abortSignal: controller.signal,
      instructions: [
        input.system,
        desktopAvailable
          ? '你可以使用本机文件和系统工具。执行写入、移动、编辑和命令操作前，遵守应用的权限审批结果。'
          : undefined,
      ]
        .filter(Boolean)
        .join('\n\n'),
      maxOutputTokens: 8192,
      messages: modelMessages,
      model,
      stopWhen: isStepCount(5),
      ...(tools
        ? {
            toolApproval: async ({ toolCall }: { toolCall: { input: unknown; toolName: string } }) => {
              let args: Record<string, unknown> | undefined
              if (isObjectLike(toolCall.input)) {
                args = toolCall.input as Record<string, unknown>
              }
              const decision = isToolApprovalRequired({
                apiName: toolCall.toolName,
                args,
                identifier: 'desktop-local-system',
                mode: permissionMode,
              })
              if (decision.decision === 'user-approval') return 'user-approval'
              if (decision.decision === 'denied') return { reason: decision.reason, type: 'denied' as const }
              return { reason: '桌面权限策略已允许', type: 'approved' as const }
            },
            tools,
          }
        : {}),
    })

    const response = createUIMessageStreamResponse({
      stream: toUIMessageStream({
        messageMetadata: createMessageMetadata(input.model, input.providerId, contextSummary),
        sendReasoning: true,
        stream: result.stream,
      }),
    })
    const reader = response.body?.getReader()
    if (!reader) throw new Error('LM Studio 未返回聊天流')

    return new Response(
      new ReadableStream<Uint8Array>({
        async pull(streamController) {
          try {
            const { done, value } = await reader.read()
            if (done) {
              dispose()
              streamController.close()
              return
            }
            streamController.enqueue(value)
          } catch (error) {
            dispose()
            streamController.error(error)
          }
        },
        cancel(reason) {
          if (!controller.signal.aborted) controller.abort(reason)
          dispose()
          return reader.cancel(reason)
        },
      }),
      { headers: response.headers, status: response.status, statusText: response.statusText }
    )
  } catch (error) {
    dispose()
    throw error
  }
}
