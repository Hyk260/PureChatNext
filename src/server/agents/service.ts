import { AgentModel } from '@pure/database/models/agent'
import type { AgentCreateInput, AgentUpdateInput } from '@pure/database/models/agent'
import { PURE_AI_AGENT_ID, PURE_AI_AGENT_SEED } from '@pure/database/schemas/agent'
import type { AgentItem } from '@pure/database/schemas/agent'

import type { AgentConfigSource, AgentProfile } from '@/const/home/agents'
import { defineAgentProfile, findCommunityDefinition } from './catalog'
import type { AgentDefinition } from './catalog'

const PROFILE_FIELDS = [
  'avatar',
  'backgroundColor',
  'description',
  'openingMessage',
  'openingQuestions',
  'systemRole',
  'title',
] as const satisfies readonly (keyof AgentProfile)[]

export type ResolvedAgent = AgentItem & {
  configSource: AgentConfigSource
  definitionRevision: string | null
  savedConfig?: AgentProfile
}

export class AgentConfigurationError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'AgentConfigurationError'
  }
}

function savedProfile(agent: AgentItem): AgentProfile {
  return {
    avatar: agent.avatar,
    backgroundColor: agent.backgroundColor,
    description: agent.description,
    openingMessage: agent.openingMessage,
    openingQuestions: agent.openingQuestions,
    systemRole: agent.systemRole,
    title: agent.title,
  }
}

export function resolveAgentConfiguration(
  agent: AgentItem,
  definition: AgentDefinition | null,
  includeSavedConfig = false
): ResolvedAgent {
  let configSource: AgentConfigSource = agent.isBuiltin ? 'builtin' : 'custom'
  if (agent.marketIdentifier) configSource = definition ? 'community' : 'snapshot'
  return {
    ...agent,
    ...definition?.profile,
    configSource,
    definitionRevision: definition?.revision ?? null,
    ...(includeSavedConfig && agent.marketIdentifier ? { savedConfig: savedProfile(agent) } : {}),
  }
}

export class AgentService {
  private readonly model: AgentModel

  constructor(userId: string) {
    this.model = new AgentModel(userId)
  }

  private resolve = async (agent: AgentItem, includeSavedConfig = false): Promise<ResolvedAgent> => {
    let definition: AgentDefinition | null = null
    if (agent.marketIdentifier) definition = await findCommunityDefinition(agent.marketIdentifier)
    else if (agent.isBuiltin && agent.id === PURE_AI_AGENT_ID) {
      definition = defineAgentProfile(savedProfile({ ...agent, ...PURE_AI_AGENT_SEED }))
    }
    return resolveAgentConfiguration(agent, definition, includeSavedConfig)
  }

  listVisible = async () => Promise.all((await this.model.listVisible()).map((agent) => this.resolve(agent)))

  findVisibleById = async (id: string) => {
    if (id === PURE_AI_AGENT_ID) await this.model.ensureBuiltin()
    const agent = await this.model.findVisibleById(id)
    return agent ? this.resolve(agent, true) : undefined
  }

  create = async (input: AgentCreateInput) => this.resolve(await this.model.create(input), true)

  install = async (identifier: string) => {
    const definition = await findCommunityDefinition(identifier)
    if (!definition) throw new AgentConfigurationError('社区助理不存在或已下架', 404)
    const { profile } = definition
    const agent = await this.model.create({
      avatar: profile.avatar ?? undefined,
      backgroundColor: profile.backgroundColor ?? undefined,
      description: profile.description ?? undefined,
      marketIdentifier: identifier,
      openingMessage: profile.openingMessage,
      openingQuestions: profile.openingQuestions,
      systemRole: profile.systemRole ?? undefined,
      title: profile.title,
    })
    return this.resolve(agent, true)
  }

  update = async (id: string, input: AgentUpdateInput) => {
    const existing = await this.model.findVisibleById(id)
    if (!existing) return undefined
    if (existing.marketIdentifier && PROFILE_FIELDS.some((field) => Object.hasOwn(input, field))) {
      throw new AgentConfigurationError('社区助理自动跟随最新配置，请另存为自定义助理后修改', 409)
    }
    const agent = await this.model.update(id, input)
    return agent ? this.resolve(agent, true) : undefined
  }
}
