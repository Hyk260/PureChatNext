import { MessageItemType, WechatApiClient } from '@pure/chat-adapter/wechat'
import debug from 'debug'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import type { ChannelEventItem } from '@pure/database/schemas/channel'
import { createNanoId } from '@pure/utils'
import { generateWechatAgentReply } from './agentBridge'
import { parseWechatCommand, WECHAT_HELP_TEXT } from './commands'
import { decryptContextToken, decryptCredentials } from './encrypt'
import { getWechatHistoryTokenBudget, trimWechatHistory } from './history'
import { startWechatTyping } from './typing'

const log = debug('channel:wechat:processor')
const EVENT_LEASE_MS = 3 * 60_000
const IDLE_DELAY_MS = 500
const MAX_TEXT_LENGTH = 2000

type ActiveGeneration = { abortController: AbortController; eventId: string }
const activeGenerations = new Map<string, ActiveGeneration>()

const sessionKey = (bindingId: string, externalUserId: string) => `${bindingId}:${externalUserId}`

function splitText(text: string): string[] {
  const chunks: string[] = []
  for (let offset = 0; offset < text.length; offset += MAX_TEXT_LENGTH) {
    chunks.push(text.slice(offset, offset + MAX_TEXT_LENGTH))
  }
  return chunks.length ? chunks : ['（空回复）']
}

function isAgentUsable(provider: string | null) {
  const normalized = provider?.trim() || 'deepseek'
  if (normalized === 'openai') return Boolean(process.env.OPENAI_API_KEY?.trim())
  if (normalized === 'deepseek') return Boolean(process.env.DEEPSEEK_API_KEY?.trim())
  return false
}

async function handleAgentsCommand(event: ChannelEventItem, argument: string) {
  const binding = await new ChannelBindingModel().findById(event.bindingId)
  if (!binding) throw new Error('Binding no longer exists')
  const credentials = decryptCredentials(binding.credentials)
  if (!credentials.userId || credentials.userId !== event.externalUserId) {
    return '该指令仅限扫码授权的微信账号使用。'
  }

  const eventModel = new ChannelEventModel()
  const session = await eventModel.getSession(event.sessionId)
  if (!session) throw new Error('Channel session not found')
  const agents = await new AgentModel(binding.userId).listVisible()

  if (!argument) {
    const current = session.activeAgentId || binding.agentId
    return [
      '可用助手：',
      ...agents.map((agent, index) => {
        const usable = isAgentUsable(agent.provider)
        const marker = agent.id === current ? '（当前）' : ''
        return `${index + 1}. ${agent.title} [${agent.id}]${usable ? '' : '（不可用：渠道未配置服务端密钥或 Provider 不支持）'}${marker}`
      }),
      '',
      '发送 /agents <序号|agentId> 切换助手。',
    ].join('\n')
  }

  const index = /^\d+$/.test(argument) ? Number(argument) - 1 : -1
  const target = index >= 0 ? agents[index] : agents.find((agent) => agent.id === argument)
  if (!target) return '未找到该助手。发送 /agents 查看列表。'
  if (!isAgentUsable(target.provider)) return '该助手的 Provider 不受支持或服务端密钥未配置，无法切换。'

  await eventModel.startNewConversation(event.sessionId, target.id, event.id)
  abortActiveGeneration(event.bindingId, event.externalUserId)
  return `已切换到「${target.title}」，并创建新对话。`
}

async function handleCommand(event: ChannelEventItem): Promise<string> {
  const command = parseWechatCommand(event.content)
  if (!command) return WECHAT_HELP_TEXT
  const model = new ChannelEventModel()

  switch (command.name) {
    case 'help':
      return WECHAT_HELP_TEXT
    case 'new':
      abortActiveGeneration(event.bindingId, event.externalUserId)
      await model.startNewConversation(event.sessionId, undefined, event.id)
      return '已创建新对话，后续消息不会使用旧对话上下文。'
    case 'stop': {
      const stopped = abortActiveGeneration(event.bindingId, event.externalUserId)
      return stopped ? '已停止当前生成。' : '当前没有正在生成的回复。'
    }
    case 'agents':
      return handleAgentsCommand(event, command.argument)
    default:
      return `未知指令 /${command.name}。\n\n${WECHAT_HELP_TEXT}`
  }
}

export function abortActiveGeneration(bindingId: string, externalUserId: string): boolean {
  const key = sessionKey(bindingId, externalUserId)
  const active = activeGenerations.get(key)
  if (!active) return false
  active.abortController.abort()
  void new ChannelEventModel().cancel(active.eventId)
  activeGenerations.delete(key)
  return true
}

async function buildResponse(event: ChannelEventItem): Promise<string> {
  if (event.responseText) return event.responseText
  // 图片/文件等非文本：入库供 Dev 展示，Agent 仍明确告知不支持
  if (event.messageKind === 'unsupported' || event.messageKind === 'image' || event.messageKind === 'file') {
    return '当前版本仅支持文本消息。'
  }
  if (event.messageKind === 'command' || event.content.startsWith('/')) return handleCommand(event)

  const binding = await new ChannelBindingModel().findById(event.bindingId)
  if (!binding?.enabled) throw new Error('Binding is inactive')
  const eventModel = new ChannelEventModel()
  const session = await eventModel.getSession(event.sessionId)
  if (!session) throw new Error('Channel session not found')
  if (session.conversationVersion !== event.conversationVersion) throw new Error('Conversation changed')

  const key = sessionKey(event.bindingId, event.externalUserId)
  if (activeGenerations.has(key)) throw new Error('A reply is already being generated')
  const abortController = new AbortController()
  activeGenerations.set(key, { abortController, eventId: event.id })
  let stopTyping = () => {}
  try {
    const agentId = session.activeAgentId || binding.agentId
    const agent = await new AgentModel(binding.userId).findVisibleById(agentId)
    const provider = agent?.provider?.trim() || 'deepseek'
    const modelId = agent?.model ?? (provider === 'openai' ? 'gpt-5.4-mini' : 'deepseek-v4-flash')
    const history = trimWechatHistory(
      await eventModel.findContext(event.sessionId, event.conversationVersion),
      getWechatHistoryTokenBudget(provider, modelId, event.content)
    )
    const credentials = decryptCredentials(binding.credentials)
    const contextToken = decryptContextToken(event.encryptedContextToken)
    const api = new WechatApiClient(credentials.botToken, credentials.botId)
    stopTyping = startWechatTyping(api, event.externalUserId, contextToken)
    return await generateWechatAgentReply({
      abortSignal: abortController.signal,
      agentId,
      history,
      userId: binding.userId,
      userText: event.content,
    })
  } finally {
    stopTyping()
    if (activeGenerations.get(key)?.eventId === event.id) activeGenerations.delete(key)
  }
}

async function sendResponse(event: ChannelEventItem, owner: string, responseText: string) {
  const binding = await new ChannelBindingModel().findById(event.bindingId)
  if (!binding?.enabled) throw new Error('Binding is inactive')
  const credentials = decryptCredentials(binding.credentials)
  const contextToken = decryptContextToken(event.encryptedContextToken)
  const api = new WechatApiClient(credentials.botToken, credentials.botId)
  const chunks = splitText(responseText)
  const model = new ChannelEventModel()
  for (let index = event.sentChunkCount; index < chunks.length; index += 1) {
    await api.sendItem(
      event.externalUserId,
      { text_item: { text: chunks[index]! }, type: MessageItemType.TEXT },
      contextToken
    )
    await model.markChunkSent(event.id, owner, index + 1)
  }
}

function safeError(error: unknown) {
  const code = String(
    (error as { code?: string | number; name?: string })?.code ?? (error as Error)?.name ?? 'PROCESSING_ERROR'
  )
  const raw = error instanceof Error ? error.message : 'Unknown processing error'
  return { code: code.slice(0, 100), message: raw.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]').slice(0, 500) }
}

export async function processNextWechatEvent(owner = `processor-${createNanoId(10)()}`): Promise<boolean> {
  const model = new ChannelEventModel()
  const event = await model.claimNext(owner, EVENT_LEASE_MS)
  if (!event) return false
  try {
    const responseText = await buildResponse(event)
    await model.saveResponse(event.id, owner, responseText)
    await sendResponse(event, owner, responseText)
    await model.complete(event.id, owner)
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      await model.cancel(event.id)
    } else {
      const safe = safeError(error)
      log('event failed id=%s code=%s', event.id, safe.code)
      await model.retryOrFail(event, owner, safe.code, safe.message)
    }
  }
  return true
}

export async function runWechatProcessor(signal?: AbortSignal, onProcessed?: () => void) {
  const owner = `processor-${createNanoId(10)()}`
  while (!signal?.aborted) {
    try {
      const processed = await processNextWechatEvent(owner)
      if (processed) onProcessed?.()
      if (!processed) await new Promise((resolve) => setTimeout(resolve, IDLE_DELAY_MS))
    } catch (error) {
      log('processor loop error owner=%s: %O', owner, error)
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
}
