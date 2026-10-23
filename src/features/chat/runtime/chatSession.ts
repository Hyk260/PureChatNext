import { Chat } from '@ai-sdk/react'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai'
import type { UIMessage } from 'ai'
import type { ChatPermissionMode } from '@pure/types'

import { putMessages, updateToolApproval, upsertToolApproval } from '@/features/chat/chatApi'
import { LOCAL_TOOL_NAMES } from '@/features/chat/localTools'
import { getMessageText, withMessageText } from '@/features/chat/messageText'
import { getToolApprovalItems } from '@/features/chat/toolApprovalParts'
import type { ChatSearchMode } from '@/features/chat/types'
import { markFirstConversion, trackAcquisitionEvent } from '@/libs/analytics/acquisition'
import { getDesktopApi } from '@/types/desktop'
import type { DesktopLocalToolRequest } from '@/types/desktop'

export type ChatRequestBody = {
  model: string
  provider: string
  searchMode: ChatSearchMode
  modelAbilities?: { vision?: boolean }
  permissionMode?: ChatPermissionMode
  system?: string
}

type SessionOptions = {
  userId: string
  agentId: string
  topicId: string | null
  messages: UIMessage[]
  onChange: () => void
  onTopicsRefresh: () => void
}

const chatTransport = new DefaultChatTransport({ api: '/api/chat', credentials: 'include' })
const signature = (messages: UIMessage[]) => JSON.stringify(messages)

const fileToPart = (file: File): Promise<Extract<UIMessage['parts'][number], { type: 'file' }>> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      resolve({
        type: 'file',
        mediaType: file.type || 'application/octet-stream',
        url: String(reader.result),
        filename: file.name,
      })
    reader.onerror = () => reject(reader.error ?? new Error('读取附件失败'))
    reader.readAsDataURL(file)
  })

const canContinue = (messages: UIMessage[]) =>
  lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
  lastAssistantMessageIsCompleteWithApprovalResponses({ messages })

/** Owns a topic's request, tools and writes independently of the visible route. */
export class ChatSession {
  readonly chat: Chat<UIMessage>
  readonly key: string
  readonly userId: string
  readonly agentId: string
  readonly topicId: string | null
  runningCommandCallIds: ReadonlySet<string> = new Set()
  private runningTools = new Set<string>()
  private body?: ChatRequestBody
  private stopRequested = false
  private blocked = false
  private preparing = false
  private epoch = 0
  private savedSignature: string
  private observedMessages: UIMessage[]
  private pendingMessages?: UIMessage[]
  private saveTimer?: ReturnType<typeof setTimeout>
  private writing?: Promise<void>
  private readonly onChange: () => void
  private readonly onTopicsRefresh: () => void

  constructor(options: SessionOptions) {
    this.userId = options.userId
    this.agentId = options.agentId
    this.topicId = options.topicId
    this.key = JSON.stringify([this.userId, this.agentId, this.topicId])
    this.savedSignature = signature(options.messages)
    this.onChange = options.onChange
    this.onTopicsRefresh = options.onTopicsRefresh
    this.chat = new Chat({
      id: this.key,
      messages: options.messages,
      transport: chatTransport,
      sendAutomaticallyWhen: ({ messages }) => !this.blocked && !this.stopRequested && canContinue(messages),
      onToolCall: async ({ toolCall }) => {
        const desktop = getDesktopApi()
        const body = this.body
        if (this.blocked || this.stopRequested || toolCall.dynamic || !desktop || !body) return
        if (!LOCAL_TOOL_NAMES.has(toolCall.toolName)) return
        const epoch = this.epoch
        const args = (toolCall.input && typeof toolCall.input === 'object' ? toolCall.input : {}) as Record<
          string,
          unknown
        >
        if (this.topicId) {
          await upsertToolApproval(this.topicId, {
            apiName: toolCall.toolName,
            args,
            identifier: 'desktop-local-system',
            toolCallId: toolCall.toolCallId,
          }).catch((error) => console.error('[chat] tool approval record failed', error))
        }
        if (this.blocked || this.stopRequested || epoch !== this.epoch || body.permissionMode === 'ask') return
        await this.executeTool({
          args,
          ...(body.permissionMode === 'auto' ? { approved: true } : {}),
          mode: body.permissionMode ?? 'auto',
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName as DesktopLocalToolRequest['toolName'],
          topicId: this.topicId ?? 'draft',
        })
      },
      onFinish: ({ messages, isAbort, isError, isDisconnect }) => {
        if (this.blocked) return
        this.scheduleSave(messages, true)
        this.flush().then(() => {
          if (!this.blocked) this.onTopicsRefresh()
        })
        const last = messages.at(-1)
        if (isAbort || isError || isDisconnect || this.stopRequested || last?.role !== 'assistant') return
        if (canContinue(messages) || getToolApprovalItems(last.parts).length > 0) return
        trackAcquisitionEvent('chat_response_completed', {
          first: markFirstConversion('chat_response'),
          model: this.body?.model ?? null,
          provider: this.body?.provider ?? null,
        })
      },
    })
    this.observedMessages = this.chat.messages
  }

  get busy() {
    return (
      !this.blocked &&
      (this.preparing ||
        this.chat.status === 'submitted' ||
        this.chat.status === 'streaming' ||
        (!this.stopRequested && this.runningTools.size > 0))
    )
  }

  get permissionMode() {
    return this.body?.permissionMode
  }

  initializeOptions(body: ChatRequestBody) {
    this.body ??= structuredClone(body)
  }

  /** Called by the global, headless useChat subscriber, including off-route updates. */
  observe(messages: UIMessage[]) {
    if (this.blocked) return
    if (this.observedMessages !== messages) {
      this.observedMessages = messages
      this.scheduleSave(messages, !this.busy)
    }
    this.onChange()
  }

  private requestOptions() {
    return {
      ...this.body,
      ...(this.topicId ? { topicId: this.topicId } : {}),
      ...(getDesktopApi() ? { clientCapabilities: { desktop: true } } : {}),
    }
  }

  async send(text: string, files: File[], body: ChatRequestBody) {
    if (this.blocked || this.busy) return
    this.body = structuredClone(body)
    this.stopRequested = false
    this.preparing = true
    const epoch = ++this.epoch
    this.onChange()
    this.chat.clearError()
    try {
      const parts = await Promise.all(files.map(fileToPart))
      if (this.blocked || this.stopRequested || epoch !== this.epoch) return
      await this.chat.sendMessage({ text, ...(parts.length ? { files: parts } : {}) }, { body: this.requestOptions() })
    } finally {
      if (epoch === this.epoch) {
        this.preparing = false
        this.onChange()
        this.scheduleSave(this.chat.messages, true)
      }
    }
  }

  async regenerate(id: string, body: ChatRequestBody) {
    if (this.blocked || this.busy) return
    const index = this.chat.messages.findIndex((message) => message.id === id)
    if (index < 0) return
    const user = this.chat.messages
      .slice(0, index)
      .reverse()
      .find((message) => message.role === 'user')
    if (!user) return
    this.body = structuredClone(body)
    this.stopRequested = false
    this.epoch += 1
    this.chat.clearError()
    this.chat.messages = this.chat.messages.filter((message) => message.id !== id)
    await this.chat.sendMessage({ text: getMessageText(user), messageId: user.id }, { body: this.requestOptions() })
  }

  edit(id: string, text: string) {
    if (this.blocked || this.busy) return
    this.chat.messages = this.chat.messages.map((message) =>
      message.id === id ? withMessageText(message, text) : message
    )
  }

  deleteMessage(id: string) {
    if (this.blocked || this.busy) return
    this.chat.messages = this.chat.messages.filter((message) => message.id !== id)
  }

  stop = () => {
    this.stopRequested = true
    this.preparing = false
    this.epoch += 1
    for (const toolCallId of this.runningCommandCallIds) {
      getDesktopApi()
        ?.cancelLocalCommand({ topicId: this.topicId ?? 'draft', toolCallId })
        .catch((error) => console.error('[chat] command cancellation failed', error))
    }
    this.chat.stop().catch((error) => console.error('[chat] stop failed', error))
    this.scheduleSave(this.chat.messages, true)
    this.onChange()
  }

  private recordToolStatus(toolCallId: string, status: 'completed' | 'failed' | 'denied' | 'approved', error?: string) {
    if (!this.topicId || this.blocked) return
    updateToolApproval(this.topicId, toolCallId, status, error).catch((cause) =>
      console.error('[chat] tool approval update failed', cause)
    )
  }

  private async executeTool(request: DesktopLocalToolRequest) {
    const desktop = getDesktopApi()
    if (!desktop || this.blocked || this.stopRequested || this.runningTools.has(request.toolCallId)) return
    const epoch = this.epoch
    this.runningTools.add(request.toolCallId)
    if (request.toolName === 'runCommand') {
      this.runningCommandCallIds = new Set([...this.runningCommandCallIds, request.toolCallId])
    }
    this.onChange()
    try {
      const output = await desktop.executeLocalTool(request).catch((error: unknown) => ({
        content: error instanceof Error ? error.message : '本地工具执行失败',
        success: false,
      }))
      if (this.blocked || this.stopRequested || epoch !== this.epoch) return
      this.recordToolStatus(
        request.toolCallId,
        output.success ? 'completed' : 'failed',
        output.success ? undefined : output.content
      )
      // Do not await inside onToolCall: the SDK queues this behind the current stream chunk.
      Promise.resolve(
        this.chat.addToolOutput({
          options: { body: this.requestOptions() },
          output,
          tool: request.toolName,
          toolCallId: request.toolCallId,
        })
      ).catch((error) => console.error('[chat] tool output failed', error))
    } finally {
      this.runningTools.delete(request.toolCallId)
      this.runningCommandCallIds = new Set([...this.runningCommandCallIds].filter((id) => id !== request.toolCallId))
      this.onChange()
    }
  }

  approveLocal(toolCallId: string, toolName: string, args: Record<string, unknown>, approved: boolean) {
    if (this.blocked || this.stopRequested || !this.topicId || !this.body) return
    if (!approved) {
      this.recordToolStatus(toolCallId, 'denied')
      Promise.resolve(
        this.chat.addToolOutput({
          options: { body: this.requestOptions() },
          output: { content: '用户拒绝了该操作', success: false },
          tool: toolName,
          toolCallId,
        })
      ).catch((error) => console.error('[chat] tool denial failed', error))
      return
    }
    this.executeTool({
      approved: true,
      args,
      mode: this.body.permissionMode ?? 'ask',
      toolCallId,
      toolName: toolName as DesktopLocalToolRequest['toolName'],
      topicId: this.topicId,
    })
  }

  approveServer(approvalId: string, toolCallId: string, approved: boolean) {
    if (this.blocked || this.stopRequested) return
    this.recordToolStatus(toolCallId, approved ? 'approved' : 'denied')
    Promise.resolve(
      this.chat.addToolApprovalResponse({ id: approvalId, approved, options: { body: this.requestOptions() } })
    ).catch((error) => console.error('[chat] tool approval failed', error))
  }

  private scheduleSave(messages: UIMessage[], immediate: boolean) {
    if (!this.topicId || this.blocked) return
    this.pendingMessages = messages
    clearTimeout(this.saveTimer)
    if (immediate) this.flush()
    else this.saveTimer = setTimeout(() => this.flush(), 400)
  }

  /** One writer per topic; later snapshots replace only the queued snapshot. */
  flush = (): Promise<void> => {
    clearTimeout(this.saveTimer)
    if (this.writing) return this.writing
    if (this.blocked || !this.topicId) return Promise.resolve()
    const topicId = this.topicId
    this.writing = (async () => {
      while (this.pendingMessages && !this.blocked) {
        const snapshot = this.pendingMessages
        this.pendingMessages = undefined
        const nextSignature = signature(snapshot)
        if (nextSignature === this.savedSignature) continue
        try {
          await putMessages(topicId, snapshot)
          this.savedSignature = nextSignature
        } catch (error) {
          this.pendingMessages ??= snapshot
          console.error('[chat] putMessages failed', error)
          break
        }
      }
    })().finally(() => {
      this.writing = undefined
    })
    return this.writing
  }

  async suspend() {
    this.blocked = true
    clearTimeout(this.saveTimer)
    this.stop()
    await this.writing
  }

  resume() {
    this.blocked = false
    this.scheduleSave(this.chat.messages, true)
    this.onChange()
  }
}
