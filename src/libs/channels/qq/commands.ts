import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'

import { buildChannelHelpText, runChannelCommand, type ChannelCommandEffects } from '../core/commands'
import { invalidateQQChat } from './chatBot'

export const QQ_HELP_TEXT = buildChannelHelpText({
  footer: '支持私聊，或在群内 @ 机器人后发送指令。',
})

type ActiveGeneration = { abortController: AbortController }
const activeGenerations = new Map<string, ActiveGeneration>()
const pendingChatInvalidations = new Set<string>()

const sessionKey = (applicationId: string, externalUserId: string) => `${applicationId}:${externalUserId}`

export function abortQQGeneration(applicationId: string, externalUserId: string): boolean {
  const key = sessionKey(applicationId, externalUserId)
  const active = activeGenerations.get(key)
  if (!active) return false
  active.abortController.abort()
  activeGenerations.delete(key)
  return true
}

export function beginQQGeneration(applicationId: string, externalUserId: string): AbortController {
  const key = sessionKey(applicationId, externalUserId)
  const existing = activeGenerations.get(key)
  if (existing) {
    existing.abortController.abort()
    activeGenerations.delete(key)
  }
  const abortController = new AbortController()
  activeGenerations.set(key, { abortController })
  return abortController
}

export function endQQGeneration(applicationId: string, externalUserId: string, controller: AbortController) {
  const key = sessionKey(applicationId, externalUserId)
  if (activeGenerations.get(key)?.abortController === controller) {
    activeGenerations.delete(key)
  }
}

/** 指令回复发出后再失效 Chat 实例，避免处理过程中关掉当前 bot。 */
export async function flushQQChatInvalidation(applicationId: string): Promise<void> {
  if (!pendingChatInvalidations.has(applicationId)) return
  pendingChatInvalidations.delete(applicationId)
  await invalidateQQChat(applicationId)
}

function createQQCommandEffects(params: {
  applicationId: string
  externalUserId: string
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
      // 延迟 invalidate：等指令回复发出后再重建 Chat（新 agentId 会进 fingerprint）
      pendingChatInvalidations.add(params.applicationId)
    },
  }
}

/** 若为指令则返回回复文案，否则返回 null。 */
export async function tryHandleQQCommand(params: {
  applicationId: string
  externalUserId: string
  text: string
  userId: string
}): Promise<string | null> {
  return runChannelCommand(
    params.text,
    createQQCommandEffects({
      applicationId: params.applicationId,
      externalUserId: params.externalUserId,
      userId: params.userId,
    }),
    { helpText: QQ_HELP_TEXT }
  )
}
