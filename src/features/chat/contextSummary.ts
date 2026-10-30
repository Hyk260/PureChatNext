import type { ChatAdvancedSettings, ChatContextSummary, ChatMessageMetadata, ServiceModelReference } from '@pure/types'
import type { UIMessage } from 'ai'

import { chatContextSummarySchema, selectChatHistory } from './advancedSettings'
import { apiFetch, jsonInit } from '@/utils/apiFetch'
import { getLmStudioRuntimeConfig } from '@/features/settings/provider/lmstudioRuntimeConfig'
import { summarizeLmStudioHistory } from '@/libs/ai-providers/lmstudio'

const toHash = async (messages: UIMessage[]) => {
  const source = JSON.stringify(messages.map(({ id, role, parts }) => ({ id, role, parts })))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const estimatedTokens = (messages: UIMessage[]) => {
  let characters = 0
  let images = 0
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === 'text') characters += part.text.length
      else if (part.type === 'file' && part.mediaType.startsWith('image/')) images += 1
      else if (part.type === 'file') characters += (part.filename ?? 'attachment').length + 80
      else characters += JSON.stringify(part).length
    }
  }
  return Math.ceil(characters / 4) + images * 1024
}

async function findCachedSummary(messages: UIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'assistant') continue
    const metadata = message.metadata as ChatMessageMetadata | undefined
    const parsed = chatContextSummarySchema.safeParse(metadata?.contextSummary)
    if (!parsed.success || parsed.data.messageCount > index) continue
    if ((await toHash(messages.slice(0, parsed.data.messageCount))) === parsed.data.sourceHash) return parsed.data
  }
}

async function requestCloudSummary({
  messages,
  sourceMessages,
  previousSummary,
  model,
}: {
  messages: UIMessage[]
  sourceMessages: UIMessage[]
  previousSummary?: string
  model: ServiceModelReference
}) {
  const response = await apiFetch(
    '/api/chat/context/summary',
    jsonInit(
      {
        contextWindowTokens: model.contextWindowTokens ?? 8192,
        messages,
        model: model.model,
        previousSummary,
        provider: model.provider,
        sourceMessages,
      },
      { method: 'POST' }
    )
  )
  const body = (await response.json().catch(() => ({}))) as { error?: string; summary?: unknown }
  if (!response.ok) throw new Error(body.error || '会话历史压缩失败')
  return chatContextSummarySchema.parse(body.summary)
}

export async function prepareAuxiliaryContextSummary({
  messages,
  settings,
  mainContextWindow,
  compressionModel,
  accountId,
}: {
  messages: UIMessage[]
  settings: ChatAdvancedSettings
  mainContextWindow?: number
  compressionModel: ServiceModelReference
  accountId?: string
}): Promise<ChatContextSummary | undefined> {
  if (!settings.enableContextCompression) return undefined
  const source = selectChatHistory(messages, settings)
  const cached = await findCachedSummary(source)
  const summarizedCount = cached?.messageCount ?? 0
  const userTurns = source.flatMap((message, index) => (message.role === 'user' ? [index] : []))
  const boundary = userTurns.at(-2) ?? 0
  const targetWindow = mainContextWindow ?? 128_000
  const totalTokens = estimatedTokens(source) + (cached?.text.length ?? 0) / 4
  if (totalTokens <= targetWindow * 0.5 && source.length < 160) return undefined
  if (boundary <= summarizedCount) return undefined

  const sourceMessages = source.slice(0, boundary)
  const summaryInput = source.slice(summarizedCount, boundary)
  if (summaryInput.length === 0) return undefined

  let summary: ChatContextSummary
  if (compressionModel.provider === 'lmstudio') {
    const config = await getLmStudioRuntimeConfig({ accountId })
    const text = await summarizeLmStudioHistory(config, {
      contextWindowTokens: compressionModel.contextWindowTokens ?? 8192,
      messages: summaryInput,
      model: compressionModel.model,
      previousSummary: cached?.text,
    })
    summary = {
      messageCount: boundary,
      sourceHash: await toHash(sourceMessages),
      text: text.trim(),
    }
  } else {
    summary = await requestCloudSummary({
      messages: summaryInput,
      sourceMessages,
      previousSummary: cached?.text,
      model: compressionModel,
    })
  }

  const parsed = chatContextSummarySchema.safeParse(summary)
  if (!parsed.success || parsed.data.messageCount !== boundary || parsed.data.sourceHash !== (await toHash(sourceMessages))) {
    throw new Error('压缩模型返回的摘要与当前会话历史不匹配')
  }
  return parsed.data
}
