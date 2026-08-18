import debug from 'debug'

const log = debug('channel:core:chat-bot-registry')

export type ChatBotLike = {
  initialize(): Promise<void>
  shutdown(): Promise<void>
}

type ChatBotEntry<T extends ChatBotLike> = {
  fingerprint: string
  instance: T
}

type PendingChatBot<T extends ChatBotLike> = {
  fingerprint: string
  promise: Promise<T>
}

export type ChatBotCreateParams = {
  applicationId: string
  fingerprint: string
  platform: string
}

export function buildChatBotCacheKey(platform: string, applicationId: string): string {
  return `${platform}:${applicationId}`
}

export function buildChatBotFingerprint(value: Record<string, unknown>): string {
  return JSON.stringify(value)
}

export class ChatBotRegistry<T extends ChatBotLike> {
  private readonly entries = new Map<string, ChatBotEntry<T>>()
  private readonly pending = new Map<string, PendingChatBot<T>>()

  async getOrCreate(params: ChatBotCreateParams, create: () => Promise<T> | T): Promise<T> {
    const key = buildChatBotCacheKey(params.platform, params.applicationId)
    const pending = this.pending.get(key)
    if (pending) {
      if (pending.fingerprint === params.fingerprint) return pending.promise
      await pending.promise.catch(() => undefined)
      return this.getOrCreate(params, create)
    }

    const existing = this.entries.get(key)
    if (existing?.fingerprint === params.fingerprint) return existing.instance
    if (existing) await this.invalidate(params.platform, params.applicationId)

    const promise = (async () => {
      const instance = await create()
      await instance.initialize()
      this.entries.set(key, { fingerprint: params.fingerprint, instance })
      return instance
    })()
    this.pending.set(key, { fingerprint: params.fingerprint, promise })
    try {
      return await promise
    } finally {
      if (this.pending.get(key)?.promise === promise) this.pending.delete(key)
    }
  }

  async invalidate(platform: string, applicationId: string): Promise<void> {
    const key = buildChatBotCacheKey(platform, applicationId)
    const pending = this.pending.get(key)
    if (pending) await pending.promise.catch(() => undefined)
    const entry = this.entries.get(key)
    this.entries.delete(key)
    if (!entry) return
    try {
      await entry.instance.shutdown()
    } catch (error) {
      log('shutdown failed key=%s: %O', key, error)
    }
  }

  async clear(): Promise<void> {
    await Promise.all([...this.entries.keys()].map((key) => {
      const separator = key.indexOf(':')
      return this.invalidate(key.slice(0, separator), key.slice(separator + 1))
    }))
  }
}
