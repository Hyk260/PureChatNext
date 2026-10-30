import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn() }))

import { QQSpeechModel } from '../qqSpeech'
import { channelBindings, channelEvents } from '../../schemas/channel'
import * as schema from '../../schemas'

config({ path: resolve(import.meta.dirname, '../../../../../.env.local'), quiet: true })
const databaseUrl = process.env.DATABASE_URL
const isLocal = databaseUrl && new Set(['localhost', '127.0.0.1', '::1']).has(new URL(databaseUrl).hostname)

describe.skipIf(!isLocal)('QQ speech PostgreSQL concurrency', () => {
  const namespace = `qq_speech_test_${randomUUID().replaceAll('-', '')}`
  const admin = postgres(databaseUrl!, { max: 1, connect_timeout: 5 })
  const client = postgres(databaseUrl!, { connection: { search_path: namespace }, max: 8, connect_timeout: 5 })
  const db = drizzle(client, { schema })
  const first = new QQSpeechModel(db)
  const second = new QQSpeechModel(db)
  const bindingId = randomUUID()
  const userId = randomUUID()

  beforeAll(async () => {
    await admin.unsafe(`CREATE SCHEMA "${namespace}"`)
    for (const table of ['channel_bindings', 'channel_events'])
      await admin.unsafe(`CREATE TABLE "${namespace}"."${table}" (LIKE public."${table}" INCLUDING ALL)`)
    await db.insert(channelBindings).values({
      id: bindingId,
      userId,
      platform: 'qq',
      applicationId: randomUUID(),
      credentials: 'test-only',
      agentId: 'agent',
    })
  })
  afterAll(async () => {
    await client.end()
    await admin.unsafe(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`)
    await admin.end()
  })

  const event = async () => {
    const id = randomUUID()
    await db.insert(channelEvents).values({
      id,
      bindingId,
      sessionId: randomUUID(),
      platformMessageId: id,
      externalUserId: 'qq:group:group',
      conversationVersion: 1,
      content: '请用语音回复',
      encryptedContextToken: '',
      platformPayload: { threadType: 'group', authorId: 'sender' },
    })
    return id
  }

  it('serializes separate instances, deduplicates reservations and counts failed attempts', async () => {
    const ids = await Promise.all(Array.from({ length: 5 }, event))
    const results = await Promise.all(
      ids.map((eventId, index) =>
        (index % 2 ? first : second).reserve({ bindingId, userId, eventId, senderId: 'sender' })
      )
    )
    expect(results.filter((result) => result === undefined)).toHaveLength(2)
    expect(results.filter((result) => result === 'CONCURRENCY_LIMIT')).toHaveLength(3)
    const accepted = ids.filter((_, index) => results[index] === undefined)
    expect(await second.reserve({ bindingId, userId, eventId: accepted[0], senderId: 'sender' })).toBe(
      'DUPLICATE_ATTEMPT'
    )
    for (const id of accepted) await first.finish(id, 'fallback', 'SPEECH_SYNTHESIS_FAILED')
    const third = await event()
    expect(await first.reserve({ bindingId, userId, eventId: third, senderId: 'sender' })).toBeUndefined()
    expect(await second.reserve({ bindingId, userId, eventId: await event(), senderId: 'sender' })).toBe(
      'SENDER_RATE_LIMIT'
    )
    expect(await first.reserveReply(third)).toBe(1)
    expect(await second.reserveReply(third)).toBe(2)
    const [stored] = await db.select().from(channelEvents).where(eq(channelEvents.id, third))
    expect(stored.platformPayload?.replySeqUsed).toBe(2)
    expect(stored.platformPayload?.threadType).toBe('group')
    const sequences = await Promise.all([first.reserveReply(third), second.reserveReply(third)])
    expect(sequences.sort()).toEqual([3, 4])
    await expect(first.reserveReply(third, 1, 1)).rejects.toThrow('QQ_REPLY_BUDGET')
    await second.cancelPending(bindingId, 'qq:group:group')
    expect(await first.isPending(third)).toBe(false)
  })
})
