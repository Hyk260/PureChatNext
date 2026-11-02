import { PURECHAT_PROVIDER_ID, isValidProviderId } from '@pure/const'
import { AgentService } from '@/server/agents/service'
import { getAiModel, getEnabledPureChatModel } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'
import type { TaskInput, TaskRunSnapshot } from '@pure/types'

import { appEnv } from '@/envs/app'
import { resolveUserProviderCredentials } from '@/libs/ai-providers/userSecrets'
import { isSupportedProviderId } from '@/libs/ai-providers/resolveClient'
import { isPureChatRuntimeAvailable } from '@/server/purechat/runtime'
import { TaskServiceError } from './errors'
import { validateTaskNotificationUrl } from './notification'
import { resolveTaskTarget } from './targets'

export async function validateTaskModel(userId: string, provider: string, model: string) {
  if (provider === PURECHAT_PROVIDER_ID) {
    if (!isPureChatRuntimeAvailable() || !getEnabledPureChatModel(model)) {
      throw new TaskServiceError('所选 PureChat 模型在服务器不可用，请重新选择')
    }
    return
  }
  if (!isSupportedProviderId(provider) && !isValidProviderId(provider)) throw new TaskServiceError('不支持该模型服务商')
  if (getAiModel(provider as ModelProviderId, model)?.enabled === false)
    throw new TaskServiceError('所选模型已停用，请重新选择')
  const credentials = await resolveUserProviderCredentials({ allowEnvFallback: false, provider, userId })
  if (!credentials) throw new TaskServiceError('云端执行需要已保存到账号的模型 API Key，请先在服务商设置中保存')
}

export async function validateTaskResources(userId: string, input: TaskInput) {
  const agent = await new AgentService(userId).findVisibleById(input.agentId)
  if (!agent) throw new TaskServiceError('执行助理不存在或无权使用', 404)
  await validateTaskModel(userId, input.provider, input.model)
  if (input.channels.length) validateTaskNotificationUrl(appEnv.APP_URL)
  for (const channel of input.channels) await resolveTaskTarget(userId, channel)
}

export async function prepareTaskSnapshot(userId: string, snapshot: TaskRunSnapshot): Promise<TaskRunSnapshot> {
  if (snapshot.systemRole !== undefined) return snapshot
  const agent = await new AgentService(userId).findVisibleById(snapshot.agentId)
  if (!agent) throw new TaskServiceError('执行助理已被删除或不可用')
  return {
    ...snapshot,
    agentTitle: agent.title,
    agentDefinitionRevision: agent.definitionRevision ?? undefined,
    systemRole: agent.systemRole ?? '',
  }
}
