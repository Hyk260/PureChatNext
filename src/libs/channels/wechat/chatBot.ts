import { createWechatAdapter } from '@pure/chat-adapter/wechat'
import { createMemoryState } from '@chat-adapter/state-memory'
import { Chat } from 'chat'
import type { Message, Thread } from 'chat'
import debug from 'debug'

import { buildChatBotFingerprint, ChatBotRegistry } from '../core/chatBotRegistry'
import { handleWechatMention } from './agentBridge'

const log = debug('channel:wechat:chatBot')

export type WechatChatContext = {
  agentId: string
  applicationId: string
  botId?: string
  botToken: string
  model: string
  provider: string
  userId: string
}

const wechatChatBotRegistry = new ChatBotRegistry<Chat>()

function registerHandlers(chat: Chat, ctx: WechatChatContext): void {
  const handler = async (thread: Thread, message: Message) => {
    await handleWechatMention({
      agentId: ctx.agentId,
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

  chat.onNewMessage(/./, async (thread, message) => {
    if (thread.isDM !== true) return
    await handler(thread, message)
  })
}

/**
 * 按 applicationId 获取或创建 Chat 实例。
 * 进程内缓存：processMessage 为异步，实例须保持存活。
 */
export async function getOrCreateWechatChat(ctx: WechatChatContext): Promise<Chat> {
  return wechatChatBotRegistry.getOrCreate(
    {
      applicationId: ctx.applicationId,
      fingerprint: buildChatBotFingerprint({
        agentId: ctx.agentId,
        applicationId: ctx.applicationId,
        botId: ctx.botId,
        botToken: ctx.botToken,
        model: ctx.model,
        provider: ctx.provider,
        userId: ctx.userId,
      }),
      platform: 'wechat',
    },
    () => {
      const adapter = createWechatAdapter({ botId: ctx.botId, botToken: ctx.botToken })
      const chat = new Chat({
        adapters: { wechat: adapter },
        concurrency: 'queue',
        state: createMemoryState(),
        userName: 'purechat-wechat',
      })
      registerHandlers(chat, ctx)
      log('created chat appId=%s agent=%s', ctx.applicationId, ctx.agentId)
      return chat
    }
  )
}

export function invalidateWechatChat(applicationId: string): Promise<void> {
  return wechatChatBotRegistry.invalidate('wechat', applicationId)
}
