import { createWechatAdapter } from '@pure/chat-adapter/wechat'
import { createMemoryState } from '@chat-adapter/state-memory'
import { Chat } from 'chat'
import type { Message, Thread } from 'chat'
import debug from 'debug'

import { handleWechatMention } from './agentBridge'

const log = debug('channel:wechat:chatBot')

export type WechatChatContext = {
  agentId: string
  applicationId: string
  botId?: string
  botToken: string
  userId: string
}

type CachedBot = {
  agentId: string
  botToken: string
  chat: Chat
  userId: string
}

const GLOBAL_KEY = '__purechat_wechat_chat_bots__' as const

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

function registerHandlers(chat: Chat, ctx: WechatChatContext): void {
  const handler = async (thread: Thread, message: Message) => {
    await handleWechatMention({
      agentId: ctx.agentId,
      message,
      thread,
      userId: ctx.userId,
    })
  }

  chat.onDirectMessage(async (thread, message) => {
    await handler(thread, message)
  })

  chat.onNewMessage(/./, async (thread, message) => {
    if (thread.isDM !== true) return
    await handler(thread, message)
  })
}

/**
 * Get or create a Chat instance for a WeChat applicationId.
 * Cached in-process because processMessage is async and the instance must stay alive.
 */
export async function getOrCreateWechatChat(ctx: WechatChatContext): Promise<Chat> {
  const cache = getBotCache()
  const existing = cache.get(ctx.applicationId)

  if (
    existing &&
    existing.botToken === ctx.botToken &&
    existing.agentId === ctx.agentId &&
    existing.userId === ctx.userId
  ) {
    return existing.chat
  }

  if (existing) {
    cache.delete(ctx.applicationId)
    log('invalidate cached chat appId=%s (creds/agent changed)', ctx.applicationId)
  }

  const adapter = createWechatAdapter({
    botId: ctx.botId,
    botToken: ctx.botToken,
  })

  const chat = new Chat({
    adapters: { wechat: adapter },
    concurrency: 'queue',
    state: createMemoryState(),
    userName: 'purechat-wechat',
  })

  registerHandlers(chat, ctx)
  await chat.initialize()

  cache.set(ctx.applicationId, {
    agentId: ctx.agentId,
    botToken: ctx.botToken,
    chat,
    userId: ctx.userId,
  })

  log('created chat appId=%s agent=%s', ctx.applicationId, ctx.agentId)
  return chat
}

export function invalidateWechatChat(applicationId: string): void {
  getBotCache().delete(applicationId)
}
