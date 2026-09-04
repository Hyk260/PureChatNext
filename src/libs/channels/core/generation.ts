export type ChannelGenerationKey = string

export type ChannelGenerationEntry = {
  abortController: AbortController
  eventId?: string
  onAbort?: () => void
}

/** 管理同一渠道会话的生成生命周期；渠道只负责提供 key 和取消副作用。 */
export class ChannelGenerationRegistry {
  private readonly active = new Map<ChannelGenerationKey, ChannelGenerationEntry>()

  has(key: ChannelGenerationKey): boolean {
    return this.active.has(key)
  }

  begin(key: ChannelGenerationKey, options: Omit<ChannelGenerationEntry, 'abortController'> = {}): AbortController {
    const existing = this.active.get(key)
    existing?.abortController.abort()
    this.active.delete(key)

    const abortController = new AbortController()
    this.active.set(key, { ...options, abortController })
    return abortController
  }

  abort(key: ChannelGenerationKey): boolean {
    const entry = this.active.get(key)
    if (!entry) return false
    entry.abortController.abort()
    this.active.delete(key)
    entry.onAbort?.()
    return true
  }

  end(key: ChannelGenerationKey, abortController: AbortController): void {
    if (this.active.get(key)?.abortController === abortController) this.active.delete(key)
  }

  get(key: ChannelGenerationKey): ChannelGenerationEntry | undefined {
    return this.active.get(key)
  }
}

export const channelGenerationRegistry = new ChannelGenerationRegistry()