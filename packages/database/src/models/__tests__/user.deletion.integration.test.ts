// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { config } from 'dotenv'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn() }))

import * as schema from '../../schemas'
import { FileModel } from '../file'
import { UserModel } from '../user'

config({ path: resolve(import.meta.dirname, '../../../../../.env.local'), quiet: true })
const databaseUrl = process.env.DATABASE_URL
const localHosts = new Set(['localhost', '127.0.0.1', '::1'])
const isLocal = databaseUrl && localHosts.has(new URL(databaseUrl).hostname)
const deletionTables = [
  'users',
  'global_files',
  'files',
  'accounts',
  'auth_sessions',
  'two_factor',
  'passkey',
  'verifications',
]

describe.skipIf(!isLocal)('UserModel deletion with shared PostgreSQL files', () => {
  const namespace = `user_deletion_test_${randomUUID().replaceAll('-', '')}`
  const admin = postgres(databaseUrl!, { max: 1 })
  const client = postgres(databaseUrl!, { connection: { search_path: namespace } })
  const db = drizzle(client, { schema })
  const ownerId = randomUUID()
  const readerId = randomUUID()
  const adminId = randomUUID()

  beforeAll(async () => {
    await admin.unsafe(`CREATE SCHEMA "${namespace}"`)
    for (const table of deletionTables) {
      await client.unsafe(`CREATE TABLE "${table}" (LIKE public."${table}" INCLUDING ALL)`)
    }
    // Reproduce the old constraint even when public already has the migration.
    await client.unsafe('ALTER TABLE "global_files" ALTER COLUMN "creator" SET NOT NULL')
    await client.unsafe(
      'ALTER TABLE "global_files" ADD FOREIGN KEY ("creator") REFERENCES "users"("id") ON DELETE SET NULL'
    )
    await client.unsafe('ALTER TABLE "files" ADD FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE')
    await client.unsafe('ALTER TABLE "files" ADD FOREIGN KEY ("file_hash") REFERENCES "global_files"("hash_id")')
    await db.insert(schema.users).values(
      [ownerId, readerId, adminId].map((id) => ({
        id,
        userId: id.replaceAll('-', ''),
        role: id === adminId ? 'admin' : 'user',
      }))
    )
    await db.insert(schema.globalFiles).values(
      ['shared', 'orphan'].map((hashId) => ({
        creator: ownerId,
        fileType: 'text/plain',
        hashId,
        size: 5,
        url: `https://storage.example/${hashId}`,
      }))
    )
    await db.insert(schema.files).values([
      {
        id: 'owner-shared',
        name: 'shared.txt',
        userId: ownerId,
        fileHash: 'shared',
        fileType: 'text/plain',
        size: 5,
        url: 'https://storage.example/shared',
      },
      {
        id: 'owner-orphan',
        name: 'orphan.txt',
        userId: ownerId,
        fileHash: 'orphan',
        fileType: 'text/plain',
        size: 5,
        url: 'https://storage.example/orphan',
      },
      {
        id: 'reader-shared',
        name: 'shared.txt',
        userId: readerId,
        fileHash: 'shared',
        fileType: 'text/plain',
        size: 5,
        url: 'https://storage.example/shared',
      },
    ])
  })

  afterAll(async () => {
    await client.end()
    await admin.unsafe(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`)
    await admin.end()
  })

  it('migrates the conflicting constraint and preserves files referenced by another user', async () => {
    const model = new UserModel(db)
    await expect(model.deleteUserByIdForAdmin(ownerId, adminId)).rejects.toMatchObject({
      cause: { code: '23502', column_name: 'creator' },
    })
    const migration = readFileSync(resolve(import.meta.dirname, '../../migrations/0032_late_barracuda.sql'), 'utf8')
    await client.unsafe(migration)

    await expect(model.deleteUserByIdForAdmin(ownerId, adminId)).resolves.toMatchObject({ found: true })
    await new FileModel(ownerId, db).deleteOrphanGlobalFiles(['shared', 'orphan'])

    expect(await db.select().from(schema.users).where(eq(schema.users.id, ownerId))).toEqual([])
    expect(await db.select({ id: schema.files.id }).from(schema.files)).toEqual([{ id: 'reader-shared' }])
    expect(
      await db.select({ hash: schema.globalFiles.hashId, creator: schema.globalFiles.creator }).from(schema.globalFiles)
    ).toEqual([{ hash: 'shared', creator: null }])
  })
})
