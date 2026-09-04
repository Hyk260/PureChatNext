import { createQQAdapter } from '@pure/chat-adapter/qq'
import { createMemoryState } from '@chat-adapter/state-memory'
import { Chat } from 'chat'
import type { Message, Thread } from 'chat'
import debug from 'debug'

import { buildChatBotFingerprint, ChatBotRegistry } from '../core/chatBotRegistry'
import { handleQQMention } from './agentBridge'

const log = debug('channel:qq:chatBot')

export type QQChatContext = {
  agentId: string
  appId: string
  appSecret: string
  applicationId: string
  bindingId: string
  model?: string | null
  provider?: string | null
  userId: string
}

const qqChatBotRegistry = new ChatBotRegistry<Chat>()

function registerHandlers(chat: Chat, ctx: QQChatContext): void {
  const handler = async (thread: Thread, message: Message) => {
    await handleQQMention({
      agentId: ctx.agentId,
      applicationId: ctx.applicationId,
      bindingId: ctx.bindingId,
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
  return qqChatBotRegistry.getOrCreate(
    {
      applicationId: ctx.applicationId,
      fingerprint: buildChatBotFingerprint({
        agentId: ctx.agentId,
        appId: ctx.appId,
        appSecret: ctx.appSecret,
        model: ctx.model,
        provider: ctx.provider,
        userId: ctx.userId,
      }),
      platform: 'qq',
    },
    () => {
      const adapter = createQQAdapter({ appId: ctx.appId, clientSecret: ctx.appSecret })
      const chat = new Chat({
        adapters: { qq: adapter },
        concurrency: 'queue',
        state: createMemoryState(),
        userName: 'purechat-qq',
      })
      registerHandlers(chat, ctx)
      log('created chat appId=%s agent=%s', ctx.applicationId, ctx.agentId)
      return chat
    }
  )
}

export function invalidateQQChat(applicationId: string): Promise<void> {
  return qqChatBotRegistry.invalidate('qq', applicationId)
}
