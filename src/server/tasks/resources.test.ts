// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskRunSnapshot } from '@pure/types'

const findAgent = vi.hoisted(() => vi.fn())
vi.mock('@/server/agents/service', () => ({
  AgentService: class {
    findVisibleById = findAgent
  },
}))
vi.mock('@/envs/app', () => ({ appEnv: {} }))
vi.mock('@/libs/ai-providers/userSecrets', () => ({ resolveUserProviderCredentials: vi.fn() }))
vi.mock('@/server/purechat/runtime', () => ({
  isPureChatRuntimeAvailable: vi.fn(),
}))
vi.mock('./targets', () => ({ resolveTaskTarget: vi.fn() }))

import { prepareTaskSnapshot } from './resources'

const pending: TaskRunSnapshot = {
  agentId: 'installed-agent',
  channels: [],
  enabled: true,
  instruction: '执行任务',
  model: 'model',
  priority: 0,
  provider: 'openai',
  schedule: { frequency: 'daily', hour: 9, minute: 0, timezone: 'Asia/Shanghai' },
  title: '任务',
}

describe('task agent configuration snapshots', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('uses the current configuration for each new run and keeps retries on the original configuration', async () => {
    findAgent.mockResolvedValue({ title: '新版助理', systemRole: 'prompt v1', definitionRevision: 'revision-1' })
    const firstRun = await prepareTaskSnapshot('owner', pending)
    expect(firstRun).toMatchObject({ systemRole: 'prompt v1', agentDefinitionRevision: 'revision-1' })
    findAgent.mockResolvedValue({ title: '新版助理', systemRole: 'prompt v2', definitionRevision: 'revision-2' })
    expect(await prepareTaskSnapshot('owner', firstRun)).toBe(firstRun)
    expect(findAgent).toHaveBeenCalledTimes(1)
    expect(await prepareTaskSnapshot('owner', pending)).toMatchObject({
      systemRole: 'prompt v2',
      agentDefinitionRevision: 'revision-2',
    })
  })

  it('rejects unavailable assistants before creating a run snapshot', async () => {
    findAgent.mockResolvedValue(undefined)
    await expect(prepareTaskSnapshot('owner', pending)).rejects.toThrow('执行助理已被删除或不可用')
  })
})
