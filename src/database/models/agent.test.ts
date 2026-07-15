// @vitest-environment node
import { resolve } from 'node:path'

import { generateCompactUuid } from '@pure/utils'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, inArray } from 'drizzle-orm'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
  serverDB: {},
}))

vi.hoisted(() => {
  const { config: loadEnv } = require('dotenv') as typeof import('dotenv')
  const { resolve: resolvePath } = require('node:path') as typeof import('node:path')
  loadEnv({ path: resolvePath(__dirname, '../../../.env.local') })
})

import { AgentDeleteError, AgentModel } from '@/database/models/agent'
import { ChatTopicModel } from '@/database/models/chatTopic'
import * as schema from '@/database/schemas'
import { agents, PURE_AI_AGENT_ID } from '@/database/schemas/agent'
import { chatTopics } from '@/database/schemas/chat'
import { users } from '@/database/schemas/user'
import type { ChatDatabase } from '@/database/type'

config({ path: resolve(__dirname, '../../../.env.local') })

const dbUrl = process.env.DATABASE_URL ?? process.env.DATABASE_TEST_URL
const describeIfDb = dbUrl ? describe : describe.skip

const createTestDb = (): ChatDatabase => {
  const client = postgres(dbUrl!, {
    ssl: process.env.DATABASE_DRIVER === 'neon' ? 'require' : false,
  })
  return drizzle(client, { schema })
}

const TEST_PREFIX = `agent-model-${Date.now()}`

const createTestUser = async (db: ChatDatabase, suffix: string) => {
  const id = `${TEST_PREFIX}-user-${suffix}`
  const userId = generateCompactUuid()

  await db.insert(users).values({
    id,
    userId,
    email: `${id}@test.local`,
    emailVerified: true,
  })

  return id
}

describeIfDb('AgentModel', () => {
  let db: ChatDatabase
  let userAId: string
  let userBId: string
  let createdAgentIds: string[] = []

  beforeAll(async () => {
    db = createTestDb()
    userAId = await createTestUser(db, 'a')
    userBId = await createTestUser(db, 'b')
  })

  afterAll(async () => {
    if (createdAgentIds.length > 0) {
      await db.delete(agents).where(inArray(agents.id, createdAgentIds))
    }
    await db.delete(chatTopics).where(inArray(chatTopics.userId, [userAId, userBId]))
    await db.delete(users).where(inArray(users.id, [userAId, userBId]))
  })

  it('ensureBuiltin inserts Pure AI and listVisible includes it', async () => {
    const model = new AgentModel(userAId, db)
    const list = await model.listVisible()
    expect(list.some((a) => a.id === PURE_AI_AGENT_ID)).toBe(true)
  })

  it('create belongs to current user and is visible only to owner', async () => {
    const agent = await new AgentModel(userAId, db).create({
      systemRole: '你是测试助理',
      title: 'A 的助理',
    })
    createdAgentIds.push(agent.id)

    expect(agent.userId).toBe(userAId)
    expect(agent.isBuiltin).toBe(false)

    const forA = await new AgentModel(userAId, db).findVisibleById(agent.id)
    expect(forA?.title).toBe('A 的助理')

    const forB = await new AgentModel(userBId, db).findVisibleById(agent.id)
    expect(forB).toBeUndefined()
  })

  it('rejects deleting builtin Pure AI', async () => {
    await expect(new AgentModel(userAId, db).delete(PURE_AI_AGENT_ID)).rejects.toMatchObject({
      code: 'builtin',
    } satisfies Partial<AgentDeleteError>)
  })

  it('rejects deleting agent that has topics', async () => {
    const agent = await new AgentModel(userAId, db).create({ title: '有话题的助理' })
    createdAgentIds.push(agent.id)

    await new ChatTopicModel(userAId, db).create({ agentId: agent.id, title: '话题' })

    await expect(new AgentModel(userAId, db).delete(agent.id)).rejects.toMatchObject({
      code: 'has_topics',
    })
  })

  it('deletes user agent without topics', async () => {
    const agent = await new AgentModel(userAId, db).create({ title: '可删助理' })
    createdAgentIds.push(agent.id)

    await new AgentModel(userAId, db).delete(agent.id)
    createdAgentIds = createdAgentIds.filter((id) => id !== agent.id)

    const found = await db.query.agents.findFirst({ where: eq(agents.id, agent.id) })
    expect(found).toBeUndefined()
  })

  it('update can change title for builtin', async () => {
    const updated = await new AgentModel(userAId, db).update(PURE_AI_AGENT_ID, {
      description: `desc-${TEST_PREFIX}`,
    })
    expect(updated?.description).toBe(`desc-${TEST_PREFIX}`)

    // restore
    await new AgentModel(userAId, db).update(PURE_AI_AGENT_ID, {
      description: '你的默认 AI 助手',
    })
  })
})
