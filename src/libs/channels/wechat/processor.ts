import { MessageItemType, WechatApiClient, WechatUploadMediaType } from '@pure/chat-adapter/wechat'
import debug from 'debug'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { ChannelEventFileModel } from '@pure/database/models/channelEventFile'
import type { ChannelEventItem } from '@pure/database/schemas/channel'
import { createNanoId } from '@pure/utils'
import type { WechatToolArtifact } from '@/server/chat/toolRegistry'
import { generateWechatAgentReply } from './agentBridge'
import type { WechatAgentReply } from './agentBridge'
import { wechatModelSupportsVision } from './agentSupport'
import { buildWechatWelcomeText, parseWechatCommand, WECHAT_HELP_TEXT } from './commands'
import { decryptContextToken, decryptCredentials } from './encrypt'
import { getWechatHistoryTokenBudget, trimWechatHistory } from './history'
import { sendWithValidWechatEventLease } from './leaseGuard'
import { listWechatConversationFiles, persistWechatFile, readWechatFile } from './fileArtifacts'
import { startWechatTyping } from './typing'
import {
  downloadStoredWechatImage,
  downloadValidatedWechatFile,
  parseWechatFileContent,
  parseWechatImageContent,
  prepareWechatFileForAgent,
  WECHAT_MAX_INBOUND_FILE_BYTES,
} from './inboundMedia'

const log = debug('channel:wechat:processor')
const EVENT_LEASE_MS = 3 * 60_000
const IDLE_DELAY_MS = 500
const MAX_TEXT_LENGTH = 2000
const SUPPORTED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'])

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
        const marker = agent.id === current ? '（当前）' : ''
        return `${index + 1}. ${agent.title} [${agent.id}]${marker}`
      }),
      '',
      '发送 /agents <序号|agentId> 切换助手。',
    ].join('\n')
  }

  const index = /^\d+$/.test(argument) ? Number(argument) - 1 : -1
  const target = index >= 0 ? agents[index] : agents.find((agent) => agent.id === argument)
  if (!target) return '未找到该助手。发送 /agents 查看列表。'
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

type WechatEventResponse = Partial<Omit<WechatAgentReply, 'text'>> & { text: string }

const systemResponse = (text: string): WechatEventResponse => ({ text })

async function buildResponse(event: ChannelEventItem): Promise<WechatEventResponse> {
  if (event.responseText) {
    return {
      ...(event.durationMs === null ? {} : { durationMs: event.durationMs }),
      ...(event.model ? { model: event.model } : {}),
      ...(event.provider ? { provider: event.provider } : {}),
      text: event.responseText,
    }
  }
  if (event.messageKind === 'unsupported') {
    return systemResponse('当前版本仅支持文本消息。')
  }
  if (event.messageKind === 'command' || event.content.startsWith('/')) {
    return systemResponse(await handleCommand(event))
  }

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
    const provider = binding.provider
    const modelId = binding.model
    if (!provider || !modelId) throw new Error('Binding model configuration is missing')
    const history = trimWechatHistory(
      await eventModel.findContext(event.sessionId, event.conversationVersion),
      getWechatHistoryTokenBudget(provider, modelId, event.content)
    )
    const credentials = decryptCredentials(binding.credentials)
    const contextToken = decryptContextToken(event.encryptedContextToken)
    const api = new WechatApiClient(credentials.botToken, credentials.botId)
    let userText = event.content
    let userContent: Parameters<typeof generateWechatAgentReply>[0]['userContent']
    if (event.messageKind === 'file') {
      const payload = parseWechatFileContent(event.content)
      if (!payload) return systemResponse('文件消息格式无效，无法处理。')
      try {
        const retained = await downloadValidatedWechatFile(api, payload)
        const inputArtifact = await persistWechatFile({
          buffer: retained.buffer,
          contentType: retained.mimeType,
          direction: 'input',
          event,
          filename: retained.fileName,
          summary: '微信用户上传的文件',
          userId: binding.userId,
        })
        const prepared = await prepareWechatFileForAgent(api, payload, retained)
        userText = `用户发送了文件：${prepared.fileName}（${prepared.fileType}）。请结合附件内容回答用户问题。`
        userContent = `${userText}\n文件 ID：${inputArtifact.file.id}\n\n<附件内容>${prepared.truncated ? '\n（内容已截断）' : ''}\n${prepared.content}\n</附件内容>`
      } catch (error) {
        return systemResponse(error instanceof Error ? error.message : '文件解析失败，暂时无法处理。')
      }
    } else if (event.messageKind === 'image') {
      const payload = parseWechatImageContent(event.content)
      if (!payload) return systemResponse('图片消息格式无效，无法处理。')
      if (!wechatModelSupportsVision(provider, modelId)) {
        return systemResponse('当前助手使用的模型不支持图片理解，请切换到支持视觉的模型后重试。')
      }
      const image = await downloadStoredWechatImage(api, payload)
      if (!image) return systemResponse('图片无法下载，可能已过期或缺少媒体凭证。')
      if (image.buffer.byteLength > WECHAT_MAX_INBOUND_FILE_BYTES) return systemResponse('图片超过 10MB 限制，无法处理。')
      if (!SUPPORTED_IMAGE_MIME.has(image.mimeType)) return systemResponse('暂不支持该图片格式，目前支持 JPG、PNG、WEBP、GIF、BMP。')
      userText = '用户发送了一张图片，请结合图片内容回答用户问题。'
      userContent = [
        { type: 'text', text: userText },
        {
          data: `data:${image.mimeType};base64,${image.buffer.toString('base64')}`,
          mediaType: image.mimeType,
          type: 'file',
        },
      ]
    }
    const conversationFiles = await listWechatConversationFiles(event.sessionId, event.conversationVersion)
    const attachmentContext = conversationFiles.length
      ? [
          '<wechat_conversation_files>',
          ...conversationFiles.map(({ artifact, file }) =>
            JSON.stringify({
              direction: artifact.direction,
              fileId: file.id,
              filename: file.name,
              summary: artifact.summary,
              version: artifact.version,
            })
          ),
          '</wechat_conversation_files>',
          '用户说“这个文件/上面的文件”时，默认使用列表中最新的 output，否则使用最新 input。多个同等候选时先询问。',
        ].join('\n')
      : undefined
    const producedArtifacts: WechatToolArtifact[] = []
    stopTyping = startWechatTyping(api, event.externalUserId, contextToken)
    return await generateWechatAgentReply({
      abortSignal: abortController.signal,
      agentId,
      attachmentContext,
      history,
      model: modelId,
      provider,
      userId: binding.userId,
      userText,
      userContent,
      wechatToolContext: {
        conversationVersion: event.conversationVersion,
        event: {
          conversationVersion: event.conversationVersion,
          id: event.id,
          sessionId: event.sessionId,
        },
        producedArtifacts,
        sessionId: event.sessionId,
        userId: binding.userId,
      },
    })
  } finally {
    stopTyping()
    if (activeGenerations.get(key)?.eventId === event.id) activeGenerations.delete(key)
  }
}

/** 扫码绑定后首次具备 context_token 时发送欢迎语（iLink 无法在绑定时主动推送）。 */
async function maybeSendPendingWelcome(params: {
  api: WechatApiClient
  binding: NonNullable<Awaited<ReturnType<ChannelBindingModel['findById']>>>
  contextToken: string
  event: ChannelEventItem
  owner: string
}) {
  if (!params.binding.pendingWelcome) return
  // 先 CAS 清除，避免并发事件或发送失败重试导致重复欢迎。
  const cleared = await new ChannelBindingModel().clearPendingWelcome(params.binding.id)
  if (!cleared) return

  const agent = await new AgentModel(params.binding.userId).findVisibleById(params.binding.agentId)
  const welcome = buildWechatWelcomeText(agent?.title ?? '助手')
  const model = new ChannelEventModel()
  try {
    for (const chunk of splitText(welcome)) {
      await sendWithValidWechatEventLease({
        eventId: params.event.id,
        hasValidLease: model.hasValidLease,
        owner: params.owner,
        send: () =>
          params.api.sendItem(
            params.event.externalUserId,
            { text_item: { text: chunk }, type: MessageItemType.TEXT },
            params.contextToken
          ),
      })
    }
    log('sent welcome binding=%s agent=%s', params.binding.id, params.binding.agentId)
  } catch (error) {
    log('welcome send failed binding=%s: %O', params.binding.id, error)
    throw error
  }
}

async function sendResponse(event: ChannelEventItem, owner: string, responseText: string) {
  const binding = await new ChannelBindingModel().findById(event.bindingId)
  if (!binding?.enabled) throw new Error('Binding is inactive')
  const credentials = decryptCredentials(binding.credentials)
  const contextToken = decryptContextToken(event.encryptedContextToken)
  const api = new WechatApiClient(credentials.botToken, credentials.botId)
  // 首条出站前先发欢迎语；仅当 sentChunkCount=0 时发送，避免分片重试时重复欢迎。
  if (event.sentChunkCount === 0) {
    await maybeSendPendingWelcome({ api, binding, contextToken, event, owner })
  }
  const chunks = splitText(responseText)
  const model = new ChannelEventModel()
  for (let index = event.sentChunkCount; index < chunks.length; index += 1) {
    await sendWithValidWechatEventLease({
      eventId: event.id,
      hasValidLease: model.hasValidLease,
      owner,
      send: () =>
        api.sendItem(
          event.externalUserId,
          { text_item: { text: chunks[index]! }, type: MessageItemType.TEXT },
          contextToken
        ),
    })
    await model.markChunkSent(event.id, owner, index + 1)
  }

  const artifactModel = new ChannelEventFileModel()
  const artifacts = (await artifactModel.listForEvent(event.id)).filter(
    ({ artifact }) => artifact.direction === 'output' && artifact.deliveryStatus !== 'sent'
  )
  for (const { artifact, file } of artifacts) {
    await artifactModel.markSending(artifact.id)
    try {
      const stored = await readWechatFile(binding.userId, file.id)
      await sendWithValidWechatEventLease({
        eventId: event.id,
        hasValidLease: model.hasValidLease,
        owner,
        send: async () => {
          const uploaded = await api.uploadCdnMedia(
            event.externalUserId,
            WechatUploadMediaType.FILE,
            stored.buffer
          )
          return api.sendItem(
            event.externalUserId,
            {
              file_item: {
                file_name: file.name,
                len: String(stored.buffer.byteLength),
                media: {
                  aes_key: uploaded.aesKey,
                  encrypt_query_param: uploaded.encryptQueryParam,
                  encrypt_type: 1,
                },
              },
              type: MessageItemType.FILE,
            },
            contextToken
          )
        },
      })
      await artifactModel.markSent(artifact.id)
    } catch (error) {
      await artifactModel.markFailed(artifact.id, error instanceof Error ? error.message : '文件发送失败')
      throw error
    }
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
    const response = await buildResponse(event)
    const saved = await model.saveResponse(event.id, owner, response)
    if (!saved) throw new Error('Event lease lost')
    await sendResponse(event, owner, response.text)
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
