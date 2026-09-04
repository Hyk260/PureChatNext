import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'
import type { ChannelEventModel } from '@pure/database/models/channelEvent'

import type { ChannelCommandEffects } from '../core/commands'
import { buildChannelHelpText, runChannelCommand } from '../core/commands'
import { channelGenerationRegistry } from '../core/generation'

export const QQ_HELP_TEXT = buildChannelHelpText({
  footer: '支持私聊，或在群内 @ 机器人后发送指令。',
})

const pendingChatInvalidations = new Set<string>()

const sessionKey = (applicationId: string, externalUserId: string) => `${applicationId}:${externalUserId}`

export function abortQQGeneration(applicationId: string, externalUserId: string): boolean {
  return channelGenerationRegistry.abort(sessionKey(applicationId, externalUserId))
}

export function beginQQGeneration(applicationId: string, externalUserId: string): AbortController {
  return channelGenerationRegistry.begin(sessionKey(applicationId, externalUserId))
}

export function endQQGeneration(applicationId: string, externalUserId: string, controller: AbortController) {
  channelGenerationRegistry.end(sessionKey(applicationId, externalUserId), controller)
}

/** 在当前 Chat handler 返回后失效实例，避免 SDK 收尾时访问已断开的 state。 */
export async function flushQQChatInvalidation(applicationId: string): Promise<void> {
  if (!pendingChatInvalidations.has(applicationId)) return
  pendingChatInvalidations.delete(applicationId)
  const { invalidateQQChat } = await import('./chatBot')
  await new Promise<void>((resolve, reject) => {
    setImmediate(() => {
      invalidateQQChat(applicationId).then(resolve, reject)
    })
  })
}

function createQQCommandEffects(params: {
  applicationId: string
  externalUserId: string
  eventId?: string
  eventModel?: ChannelEventModel
  sessionId?: string
  userId: string
}): ChannelCommandEffects {
  const bindingModel = new ChannelBindingModel()

  return {
    abortActiveGeneration: () => abortQQGeneration(params.applicationId, params.externalUserId),
    getCurrentAgentId: async () => {
      const binding = await bindingModel.findByUserAndPlatform(params.userId, QQ_PLATFORM)
      if (!binding) throw new Error('Binding no longer exists')
      return binding.agentId
    },
    listAgents: async () => {
      const agents = await new AgentModel(params.userId).listVisible()
      return agents.map((agent) => ({ id: agent.id, title: agent.title }))
    },
    startNewConversation: async (agentId) => {
      if (agentId) {
        const updated = await bindingModel.updateAgent(params.userId, QQ_PLATFORM, agentId)
        if (!updated) throw new Error('Binding no longer exists')
      }
      if (params.eventModel && params.sessionId) {
        const updated = await params.eventModel.startNewConversation(params.sessionId, agentId, params.eventId)
        if (!updated) throw new Error('Conversation no longer exists')
      }
      // 延迟 invalidate：等指令回复发出后再重建 Chat（新 agentId 会进 fingerprint）
      pendingChatInvalidations.add(params.applicationId)
    },
  }
}

/** 若为指令则返回回复文案，否则返回 null。 */
export async function tryHandleQQCommand(params: {
  applicationId: string
  eventId?: string
  eventModel?: ChannelEventModel
  externalUserId: string
  sessionId?: string
  text: string
  userId: string
}): Promise<string | null> {
  return runChannelCommand(
    params.text,
    createQQCommandEffects({
      applicationId: params.applicationId,
      externalUserId: params.externalUserId,
      eventId: params.eventId,
      eventModel: params.eventModel,
      sessionId: params.sessionId,
      userId: params.userId,
    }),
    { helpText: QQ_HELP_TEXT }
  )
}
