import { MessageItemType, WechatApiClient, WechatUploadMediaType } from '@pure/chat-adapter/wechat'
import debug from 'debug'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { ChannelEventFileModel } from '@pure/database/models/channelEventFile'
import type { ChannelEventItem } from '@pure/database/schemas/channel'
import { createNanoId } from '@pure/utils'
import type { ChannelToolArtifact } from '@/server/chat/toolRegistry'
import { applyChannelFirstBindWelcome, runChannelCommand } from '../core/commands'
import { getChannelHistoryTokenBudget, trimChannelHistory } from '../core/history'
import { generateWechatAgentReply } from './agentBridge'
import type { WechatAgentReply } from './agentBridge'
import { wechatModelSupportsVision } from './agentSupport'
import { WECHAT_HELP_TEXT } from './commands'
import { decryptContextToken, decryptCredentials } from './encrypt'
import { sendWithValidWechatEventLease } from './leaseGuard'
import { listWechatConversationFiles, persistWechatFile, readWechatFile } from './fileArtifacts'
import { startWechatTyping } from './typing'
import { parseWechatFileContent, parseWechatImageContent } from './content'

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

async function handleCommand(event: ChannelEventItem): Promise<string> {
  const binding = await new ChannelBindingModel().findById(event.bindingId)
  if (!binding) throw new Error('Binding no longer exists')
  const eventModel = new ChannelEventModel()
  const session = await eventModel.getSession(event.sessionId)
  if (!session) throw new Error('Channel session not found')

  const reply = await runChannelCommand(
    event.content,
    {
      abortActiveGeneration: () => abortActiveGeneration(event.bindingId, event.externalUserId),
      assertAgentsAllowed: async () => {
        const credentials = decryptCredentials(binding.credentials)
        if (!credentials.userId || credentials.userId !== event.externalUserId) {
          return '该指令仅限扫码授权的微信账号使用。'
        }
        return null
      },
      getCurrentAgentId: async () => session.activeAgentId || binding.agentId,
      listAgents: async () => {
        const agents = await new AgentModel(binding.userId).listVisible()
        return agents.map((agent) => ({ id: agent.id, title: agent.title }))
      },
      startNewConversation: async (agentId) => {
        await eventModel.startNewConversation(event.sessionId, agentId, event.id)
      },
    },
    { helpText: WECHAT_HELP_TEXT }
  )
  return reply ?? WECHAT_HELP_TEXT
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

function buildConversationFileContext(
  conversationFiles: Awaited<ReturnType<typeof listWechatConversationFiles>>
) {
  if (!conversationFiles.length) return undefined
  return [
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
}

async function buildResponse(event: ChannelEventItem): Promise<WechatEventResponse> {
  if (event.responseText) {
    return {
      ...(event.durationMs === null ? {} : { durationMs: event.durationMs }),
      ...(event.model ? { model: event.model } : {}),
      ...(event.provider ? { provider: event.provider } : {}),
      text: event.responseText,
    }
  }
  if (event.messageKind === 'audio' || event.messageKind === 'video' || event.messageKind === 'unsupported') {
    const kindLabel = event.messageKind === 'audio' ? '语音' : event.messageKind === 'video' ? '视频' : '该类型'
    return systemResponse(`当前版本暂不支持${kindLabel}消息`)
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
    const history = trimChannelHistory(
      await eventModel.findContext(event.sessionId, event.conversationVersion),
      getChannelHistoryTokenBudget(provider, modelId, event.content)
    )
    const credentials = decryptCredentials(binding.credentials)
    const contextToken = decryptContextToken(event.encryptedContextToken)
    const api = new WechatApiClient(credentials.botToken, credentials.botId)
    let userText = event.content
    let userContent: Parameters<typeof generateWechatAgentReply>[0]['userContent']
    if (event.messageKind === 'file') {
      const { downloadValidatedWechatFile, prepareWechatFileForAgent } = await import('./inboundMedia')
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
      const { downloadStoredWechatImage, WECHAT_MAX_INBOUND_FILE_BYTES } = await import('./inboundMedia')
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
    const attachmentContext = buildConversationFileContext(conversationFiles)
    const producedArtifacts: ChannelToolArtifact[] = []
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
        files: { list: listWechatConversationFiles, persist: persistWechatFile, read: readWechatFile },
        sessionId: event.sessionId,
        userId: binding.userId,
      },
    })
  } finally {
    stopTyping()
    if (activeGenerations.get(key)?.eventId === event.id) activeGenerations.delete(key)
  }
}

async function sendResponse(event: ChannelEventItem, owner: string, responseText: string) {
  const bindingModel = new ChannelBindingModel()
  const binding = await bindingModel.findById(event.bindingId)
  if (!binding?.enabled) throw new Error('Binding is inactive')
  const credentials = decryptCredentials(binding.credentials)
  const contextToken = decryptContextToken(event.encryptedContextToken)
  const api = new WechatApiClient(credentials.botToken, credentials.botId)
  let outboundText = responseText
  // 首条出站时将欢迎语拼入同一条回复；iLink 无法在绑定时主动推送。
  if (event.sentChunkCount === 0 && binding.pendingWelcome) {
    const agent = await new AgentModel(binding.userId).findVisibleById(binding.agentId)
    outboundText = await applyChannelFirstBindWelcome({
      agentTitle: agent?.title ?? '助手',
      bindingId: binding.id,
      clearPendingWelcome: (id) => bindingModel.clearPendingWelcome(id),
      pendingWelcome: binding.pendingWelcome,
      reply: responseText,
    })
    if (outboundText !== responseText) {
      log('prepended welcome binding=%s agent=%s', binding.id, binding.agentId)
    }
  }
  const chunks = splitText(outboundText)
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
  const event = await model.claimNext(owner, EVENT_LEASE_MS, 'wechat')
  if (!event) return false
  try {
    const response = await buildResponse(event)
    const saved = await model.saveResponse(event.id, owner, response)
    if (!saved) throw new Error('Event lease lost')
    await sendResponse(event, owner, response.text)
    await model.complete(event.id, owner)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      await model.cancel(event.id)
    } else {
      const safe = safeError(error)
      log('event failed id=%s code=%s message=%s', event.id, safe.code, safe.message)
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
