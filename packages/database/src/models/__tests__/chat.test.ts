// @vitest-environment node
import { resolve } from 'node:path'

import { generateCompactUuid } from '@pure/utils'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { inArray } from 'drizzle-orm'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@pure/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
  serverDB: {},
}))

import { ChatMessageModel } from '@pure/database/models/chatMessage'
import { ChatTopicModel } from '@pure/database/models/chatTopic'
import * as schema from '@pure/database/schemas'
import { chatTopics } from '@pure/database/schemas/chat'
import { users } from '@pure/database/schemas/user'
import type { ChatDatabase } from '@pure/database/type'

config({ path: resolve(__dirname, '../../../../../.env.local') })

const dbUrl = process.env.DATABASE_URL ?? process.env.DATABASE_TEST_URL
const describeIfDb = dbUrl ? describe : describe.skip

const createTestDb = (): ChatDatabase => {
  const client = postgres(dbUrl!, {
    ssl: process.env.DATABASE_DRIVER === 'neon' ? 'require' : false,
  })
  return drizzle(client, { schema })
}

const TEST_PREFIX = `chat-model-${Date.now()}`
const TEST_AGENT_ID = `${TEST_PREFIX}-agent`

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

describeIfDb('ChatTopicModel ownership', () => {
  let db: ChatDatabase
  let userAId: string
  let userBId: string
  let topicId: string

  beforeAll(async () => {
    db = createTestDb()
    userAId = await createTestUser(db, 'a')
    userBId = await createTestUser(db, 'b')

    const topicModelA = new ChatTopicModel(userAId, db)
    const topic = await topicModelA.create({ agentId: TEST_AGENT_ID, title: 'A 的话题' })
    topicId = topic.id
  })

  afterAll(async () => {
    await db.delete(chatTopics).where(inArray(chatTopics.userId, [userAId, userBId]))
    await db.delete(users).where(inArray(users.id, [userAId, userBId]))
  })

  it('allows owner findById', async () => {
    const topic = await new ChatTopicModel(userAId, db).findById(topicId)
    expect(topic?.id).toBe(topicId)
    expect(topic?.permissionMode).toBe('auto')
    expect(topic?.title).toBe('A 的话题')
  })

  it('returns undefined when another user findById', async () => {
    const topic = await new ChatTopicModel(userBId, db).findById(topicId)
    expect(topic).toBeUndefined()
  })

  it('returns undefined when another user updateTitle', async () => {
    const updated = await new ChatTopicModel(userBId, db).updateTitle(topicId, 'B 篡改')
    expect(updated).toBeUndefined()

    const topic = await new ChatTopicModel(userAId, db).findById(topicId)
    expect(topic?.title).toBe('A 的话题')
  })

  it('persists favorite and project changes for the owner only', async () => {
    const topicModelA = new ChatTopicModel(userAId, db)
    const updated = await topicModelA.update(topicId, { favorite: true, projectName: 'PureChat' })

    expect(updated?.favorite).toBe(true)
    expect(updated?.projectName).toBe('PureChat')

    const blocked = await new ChatTopicModel(userBId, db).update(topicId, {
      favorite: false,
      projectName: 'Other',
    })
    expect(blocked).toBeUndefined()

    const topic = await topicModelA.findById(topicId)
    expect(topic?.favorite).toBe(true)
    expect(topic?.projectName).toBe('PureChat')
  })

  it('persists permission changes for the owner only', async () => {
    const topicModelA = new ChatTopicModel(userAId, db)
    const updated = await topicModelA.update(topicId, { permissionMode: 'full' })
    expect(updated?.permissionMode).toBe('full')

    const blocked = await new ChatTopicModel(userBId, db).update(topicId, { permissionMode: 'ask' })
    expect(blocked).toBeUndefined()
    expect((await topicModelA.findById(topicId))?.permissionMode).toBe('full')
  })

  it('has no effect when another user delete', async () => {
    await new ChatTopicModel(userBId, db).delete(topicId)

    const topic = await new ChatTopicModel(userAId, db).findById(topicId)
    expect(topic?.id).toBe(topicId)
  })

  it('lists topics only for the owning user and agent', async () => {
    const ownerTopics = await new ChatTopicModel(userAId, db).listByAgent(TEST_AGENT_ID)
    expect(ownerTopics.some((topic) => topic.id === topicId)).toBe(true)

    const otherTopics = await new ChatTopicModel(userBId, db).listByAgent(TEST_AGENT_ID)
    expect(otherTopics).toEqual([])
  })

  it('bulk deletes by agent while preserving favorites when requested', async () => {
    const agentId = `${TEST_AGENT_ID}-bulk`
    const model = new ChatTopicModel(userAId, db)
    const favorite = await model.create({ agentId, title: 'Favorite' })
    const regular = await model.create({ agentId, title: 'Regular' })
    await model.update(favorite.id, { favorite: true })

    const deletedRegular = await model.deleteByAgent(agentId, 'unfavorited')
    expect(deletedRegular.map((item) => item.id)).toEqual([regular.id])
    expect(await model.findById(favorite.id)).toBeDefined()

    const deletedRest = await model.deleteByAgent(agentId, 'all')
    expect(deletedRest.map((item) => item.id)).toEqual([favorite.id])
  })
})

describeIfDb('ChatMessageModel ownership', () => {
  let db: ChatDatabase
  let userAId: string
  let userBId: string
  let topicId: string

  beforeAll(async () => {
    db = createTestDb()
    userAId = await createTestUser(db, 'msg-a')
    userBId = await createTestUser(db, 'msg-b')

    const topic = await new ChatTopicModel(userAId, db).create({
      agentId: `${TEST_PREFIX}-msg-agent`,
    })
    topicId = topic.id

    await new ChatMessageModel(userAId, db).replaceAll(topicId, [
      {
        id: `${TEST_PREFIX}-msg-1`,
        role: 'user',
        parts: [{ type: 'text', text: 'hello' }],
      },
    ])
  })

  afterAll(async () => {
    await db.delete(chatTopics).where(inArray(chatTopics.userId, [userAId, userBId]))
    await db.delete(users).where(inArray(users.id, [userAId, userBId]))
  })

  it('returns messages for topic owner', async () => {
    const messages = await new ChatMessageModel(userAId, db).listByTopic(topicId)
    expect(messages).toHaveLength(1)
    expect(messages[0]?.parts).toEqual([{ type: 'text', text: 'hello' }])
  })

  it('returns empty list when another user listByTopic', async () => {
    const messages = await new ChatMessageModel(userBId, db).listByTopic(topicId)
    expect(messages).toEqual([])
  })

  it('throws when another user replaceAll', async () => {
    await expect(
      new ChatMessageModel(userBId, db).replaceAll(topicId, [
        {
          id: `${TEST_PREFIX}-msg-2`,
          role: 'assistant',
          parts: [{ type: 'text', text: 'blocked' }],
        },
      ])
    ).rejects.toThrow('Topic not found')

    const messages = await new ChatMessageModel(userAId, db).listByTopic(topicId)
    expect(messages).toHaveLength(1)
    expect(messages[0]?.parts).toEqual([{ type: 'text', text: 'hello' }])
  })

  it('preserves message order after replaceAll then listByTopic', async () => {
    const orderedMessages = [
      {
        id: `${TEST_PREFIX}-order-1`,
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'first' }],
      },
      {
        id: `${TEST_PREFIX}-order-2`,
        role: 'assistant' as const,
        parts: [{ type: 'text' as const, text: 'second' }],
      },
      {
        id: `${TEST_PREFIX}-order-3`,
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'third' }],
      },
    ]

    await new ChatMessageModel(userAId, db).replaceAll(topicId, orderedMessages)

    const messages = await new ChatMessageModel(userAId, db).listByTopic(topicId)
    expect(messages.map((message) => message.id)).toEqual(orderedMessages.map((message) => message.id))
    expect(messages.map((message) => message.parts)).toEqual(orderedMessages.map((message) => message.parts))
  })

  it('persists assistant message metadata', async () => {
    const metadata = {
      model: 'deepseek-reasoner',
      performance: { tps: 20.25, ttft: 1100 },
      provider: 'deepseek',
      usage: {
        outputReasoningTokens: 40,
        outputTextTokens: 60,
        totalInputTokens: 100,
        totalOutputTokens: 100,
        totalTokens: 200,
      },
    }

    await new ChatMessageModel(userAId, db).replaceAll(topicId, [
      {
        id: `${TEST_PREFIX}-metadata`,
        metadata,
        parts: [{ text: 'with usage', type: 'text' }],
        role: 'assistant',
      },
    ])

    const messages = await new ChatMessageModel(userAId, db).listByTopic(topicId)
    expect(messages[0]?.metadata).toEqual(metadata)
  })

  it('serializes concurrent replaceAll without primary key conflict', async () => {
    const sharedId = `${TEST_PREFIX}-concurrent-shared`
    const model = new ChatMessageModel(userAId, db)

    const snapshots = Array.from({ length: 3 }, (_, index) => [
      {
        id: sharedId,
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: `wave-${index}` }],
      },
      {
        id: `${TEST_PREFIX}-concurrent-tail-${index}`,
        role: 'assistant' as const,
        parts: [{ type: 'text' as const, text: `reply-${index}` }],
      },
    ])

    await expect(Promise.all(snapshots.map((messages) => model.replaceAll(topicId, messages)))).resolves.toEqual([
      undefined,
      undefined,
      undefined,
    ])

    const messages = await model.listByTopic(topicId)
    expect(messages).toHaveLength(2)
    expect(messages[0]?.id).toBe(sharedId)
    expect(messages[0]?.parts).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringMatching(/^wave-\d+$/) }),
    ])
    expect(messages[1]?.id).toMatch(new RegExp(`^${TEST_PREFIX}-concurrent-tail-\\d+$`))
  }, 30_000)
})
