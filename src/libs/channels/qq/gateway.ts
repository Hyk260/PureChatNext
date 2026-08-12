import { createMemoryState } from '@chat-adapter/state-memory'
import { createQQAdapter } from '@pure/chat-adapter/qq'
import type { QQGatewayConnection } from '@pure/chat-adapter/qq'
import { Chat } from 'chat'
import debug from 'debug'

import type { ChannelBindingItem } from '@pure/database/schemas/channel'
import { buildChannelGatewayHeaders, buildChannelGatewayWebhookUrl } from '@/server/channel-gateway/internal'
import type { ChannelGatewayStatusEvent } from '@/server/channel-gateway/types'

import { decryptCredentials } from './encrypt'

const log = debug('channel:qq:gateway')

export class QQChannelGatewayClient {
  private readonly abortController = new AbortController()
  private chat: Chat | null = null
  private connection: QQGatewayConnection | null = null
  private donePromise: Promise<void> | null = null
  private stopped = false

  constructor(
    private readonly binding: ChannelBindingItem,
    private readonly reportStatus: (event: ChannelGatewayStatusEvent) => void
  ) {}

  get done(): Promise<void> {
    return this.donePromise ?? Promise.resolve()
  }

  async start(): Promise<void> {
    if (this.stopped) throw new Error('QQ gateway client has been stopped')
    const credentials = decryptCredentials(this.binding.credentials)
    if (credentials.connectionMode !== 'websocket') throw new Error('QQ binding is not configured for WebSocket')
    const adapter = createQQAdapter({ appId: credentials.appId, clientSecret: credentials.appSecret })
    this.chat = new Chat({ adapters: { qq: adapter }, concurrency: 'queue', state: createMemoryState(), userName: 'purechat-qq-gateway' })
    await this.chat.initialize()
    this.connection = await adapter.startGatewayListener(
      { waitUntil: (task) => void task },
      undefined,
      this.abortController.signal,
      buildChannelGatewayWebhookUrl(`/api/channels/qq/webhook/${encodeURIComponent(this.binding.applicationId)}`),
      buildChannelGatewayHeaders('qq'),
      {
        onForwardError: (error) => log('webhook forward failed: %O', error),
        onStatus: (status, detail) => this.reportStatus({ ...detail, status }),
      }
    )
    this.donePromise = this.connection.done
  }

  async stop(): Promise<void> {
    if (this.stopped) return
    this.stopped = true
    this.abortController.abort()
    this.connection?.close()
    await this.chat?.shutdown().catch(() => undefined)
    await this.donePromise?.catch(() => undefined)
  }
}
