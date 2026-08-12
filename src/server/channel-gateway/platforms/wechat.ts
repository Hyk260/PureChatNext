import { createHash } from 'node:crypto'

import { pollWechatUpdates } from '@/libs/channels/wechat/poller'
import { forwardWechatBatch } from '@/libs/channels/wechat/webhook'

import type { ChannelGatewayClient, ChannelGatewayPlatformDefinition } from '../types'

class WechatGatewayClient implements ChannelGatewayClient {
  private readonly abortController = new AbortController()
  private loop: Promise<void> | null = null
  private readyReject!: (error: Error) => void
  private readyResolve!: () => void
  private readonly ready = new Promise<void>((resolve, reject) => {
    this.readyResolve = resolve
    this.readyReject = reject
  })
  private stopped = false

  constructor(
    private readonly context: Parameters<ChannelGatewayPlatformDefinition['createClient']>[0]
  ) {}

  get done(): Promise<void> {
    return this.loop ?? Promise.resolve()
  }

  async start(): Promise<void> {
    if (this.stopped) throw new Error('WeChat gateway client has been stopped')
    if (!this.loop) {
      this.loop = pollWechatUpdates(this.context.binding, {
        forwardBatch: (batch, signal) => forwardWechatBatch(this.context.binding.applicationId, batch, signal),
        onReady: this.readyResolve,
        onSessionExpired: () => {
          this.context.reportStatus({ code: 'SESSION_EXPIRED', message: 'WeChat session expired', status: 'needs_rebind' })
          this.readyReject(new Error('WeChat session expired'))
        },
        onStatus: this.context.reportStatus,
        signal: this.abortController.signal,
      })
      void this.loop.catch((error) => this.readyReject(error instanceof Error ? error : new Error('WeChat gateway failed')))
    }
    await this.ready
  }

  async stop(): Promise<void> {
    if (this.stopped) return
    this.stopped = true
    this.abortController.abort()
    this.readyReject(Object.assign(new Error('WeChat gateway stopped'), { name: 'AbortError' }))
    await this.loop?.catch(() => undefined)
  }
}

export const wechatGatewayPlatform: ChannelGatewayPlatformDefinition = {
  platform: 'wechat',
  transport: 'polling',
  createClient: (context) => new WechatGatewayClient(context),
  fingerprint: (binding) => createHash('sha256').update(binding.credentials).digest('hex'),
  shouldManage: () => true,
}
