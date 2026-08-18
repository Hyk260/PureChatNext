import type { ModelMessage } from 'ai'

export type ChannelPlatform = 'qq' | 'wechat' | (string & {})

export type ChannelTransport = 'polling' | 'webhook' | 'websocket'

export type ChannelCapabilities = {
  supportsAttachments: boolean
  supportsImageInput: boolean
  supportsMarkdown: boolean
  supportsMessageEdit: boolean
  supportsTyping: boolean
  transport: ChannelTransport
}

export type ChannelAttachment = {
  data?: string | Uint8Array | URL
  mediaType?: string
  name?: string
  type: 'audio' | 'file' | 'image' | 'video'
  url?: string
}

export type ChannelArtifact = Record<string, unknown>

export type ChannelAgentRequest = {
  abortSignal?: AbortSignal
  agentId: string
  attachments?: ChannelAttachment[]
  generation?: ChannelGenerationOptions
  history?: ModelMessage[]
  model?: string | null
  platform: ChannelPlatform
  provider?: string | null
  sessionId?: string
  text: string
  userId: string
}

export type ChannelAgentResponse = {
  artifacts?: ChannelArtifact[]
  durationMs: number
  model: string
  provider: string
  text: string
}

export type ChannelGenerationOptions = {
  instructions?: string
  messages?: ModelMessage[]
  onStepEnd?: (event: unknown) => void
  prepareStep?: (event: unknown) => unknown
  stopWhen?: unknown
  tools?: unknown
}

export type ChannelInboundMessage = {
  attachments?: ChannelAttachment[]
  externalUserId: string
  externalUserName?: string
  messageKind: 'audio' | 'command' | 'file' | 'image' | 'text' | 'unsupported' | 'video'
  platform: ChannelPlatform
  platformMessageId: string
  raw?: unknown
  text: string
  threadId?: string
}

export type ChannelReply = {
  attachments?: ChannelAttachment[]
  markdown?: string
  text: string
}

export type ChannelTarget = {
  externalUserId?: string
  threadId: string
}

export interface ChannelClient {
  createAdapter(): Record<string, unknown>
  formatReply(text: string): string
  normalizeInbound(input: unknown): ChannelInboundMessage
  sendReply(target: ChannelTarget, reply: ChannelReply): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
}

export type ChannelPlatformDefinition = {
  capabilities: ChannelCapabilities
  id: ChannelPlatform
  name: string
}
