import { createQQAdapter } from '@pure/chat-adapter/qq'
import { createMemoryState } from '@chat-adapter/state-memory'
import { Chat } from 'chat'
import type { Message, Thread } from 'chat'
import debug from 'debug'

import { handleQQMention } from './agentBridge'

const log = debug('channel:qq:chatBot')

export type QQChatContext = {
  agentId: string
  appId: string
  appSecret: string
  applicationId: string
  model?: string | null
  provider?: string | null
  userId: string
}

type CachedBot = {
  agentId: string
  appSecret: string
  chat: Chat
  model?: string | null
  provider?: string | null
  userId: string
}

const GLOBAL_KEY = '__purechat_qq_chat_bots__' as const

type GlobalWithBots = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, CachedBot>
}

function getBotCache(): Map<string, CachedBot> {
  const g = globalThis as GlobalWithBots
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map()
  }
  return g[GLOBAL_KEY]
}

function registerHandlers(chat: Chat, ctx: QQChatContext): void {
  const handler = async (thread: Thread, message: Message) => {
    await handleQQMention({
      agentId: ctx.agentId,
      applicationId: ctx.applicationId,
      message,
      model: ctx.model,
      provider: ctx.provider,
      thread,
      userId: ctx.userId,
    })
  }

  chat.onDirectMessage(async (thread, message) => {
    await handler(thread, message)
  })

  // Group / guild @mentions (skip DMs — already handled above)
  chat.onNewMessage(/./, async (thread, message) => {
    if (thread.isDM === true) return
    await handler(thread, message)
  })
}

/**
 * Get or create a Chat instance for a QQ applicationId.
 * Cached in-process because processMessage is async and the instance must stay alive.
 */
export async function getOrCreateQQChat(ctx: QQChatContext): Promise<Chat> {
  const cache = getBotCache()
  const existing = cache.get(ctx.applicationId)

  if (
    existing &&
    existing.appSecret === ctx.appSecret &&
    existing.agentId === ctx.agentId &&
    existing.model === ctx.model &&
    existing.provider === ctx.provider &&
    existing.userId === ctx.userId
  ) {
    return existing.chat
  }

  if (existing) {
    cache.delete(ctx.applicationId)
    log('invalidate cached chat appId=%s (creds/agent changed)', ctx.applicationId)
  }

  const adapter = createQQAdapter({
    appId: ctx.appId,
    clientSecret: ctx.appSecret,
  })

  const chat = new Chat({
    adapters: { qq: adapter },
    concurrency: 'queue',
    state: createMemoryState(),
    userName: 'purechat-qq',
  })

  registerHandlers(chat, ctx)
  await chat.initialize()

  cache.set(ctx.applicationId, {
    agentId: ctx.agentId,
    appSecret: ctx.appSecret,
    chat,
    model: ctx.model,
    provider: ctx.provider,
    userId: ctx.userId,
  })

  log('created chat appId=%s agent=%s', ctx.applicationId, ctx.agentId)
  return chat
}

export function invalidateQQChat(applicationId: string): void {
  getBotCache().delete(applicationId)
}
