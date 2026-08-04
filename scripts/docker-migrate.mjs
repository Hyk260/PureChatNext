import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import postgres from 'postgres'

const DATABASE_WAIT_ATTEMPTS = 30
const DATABASE_WAIT_DELAY_MS = 2000
const MIGRATION_LOCK_ID = 1_938_477_201
const SHA256_HEX_LENGTH = 64
const STATEMENT_BREAKPOINT = '--> statement-breakpoint'

const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration))

const migrationsFolder = process.env.MIGRATIONS_FOLDER || '/app/migrations'
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required before starting the container')
}

async function waitForDatabase(sql) {
  let lastError

  for (let attempt = 1; attempt <= DATABASE_WAIT_ATTEMPTS; attempt += 1) {
    try {
      await sql`SELECT 1`
      return
    } catch (error) {
      lastError = error
      console.log(`[Database] waiting for PostgreSQL (${attempt}/${DATABASE_WAIT_ATTEMPTS})`)
      await sleep(DATABASE_WAIT_DELAY_MS)
    }
  }

  throw lastError
}

async function readMigrations() {
  const journalPath = path.join(migrationsFolder, 'meta/_journal.json')
  const journal = JSON.parse(await readFile(journalPath, 'utf8'))
  const availableFiles = new Set(await readdir(migrationsFolder))

  return Promise.all(
    journal.entries.map(async (entry) => {
      const filename = `${entry.tag}.sql`
      if (!availableFiles.has(filename)) throw new Error(`Migration file is missing: ${filename}`)

      const sqlText = await readFile(path.join(migrationsFolder, filename), 'utf8')
      return {
        hash: createHash('sha256').update(sqlText).digest('hex'),
        statements: sqlText
          .split(STATEMENT_BREAKPOINT)
          .map((statement) => statement.trim())
          .filter(Boolean),
        tag: entry.tag,
        when: entry.when,
      }
    })
  )
}

async function assertMigrationStateHealthy(tx, migrations) {
  const [lastMigration] = await tx`
    SELECT hash, created_at
    FROM drizzle.__drizzle_migrations
    ORDER BY created_at DESC
    LIMIT 1
  `
  const [{ users_exists: usersExists }] = await tx`
    SELECT to_regclass('public.users') IS NOT NULL AS users_exists
  `

  if (lastMigration && lastMigration.hash.length !== SHA256_HEX_LENGTH) {
    throw new Error('Migration state is invalid: latest migration hash is not SHA256')
  }

  const lastAppliedWhen = lastMigration ? Number(lastMigration.created_at) : null
  const firstMigrationWhen = migrations[0]?.when
  if (usersExists && (lastAppliedWhen === null || lastAppliedWhen < firstMigrationWhen)) {
    throw new Error('Migration state is invalid: users table exists without a matching migration record')
  }

  return lastAppliedWhen
}

async function runMigrations(sql) {
  const migrations = await readMigrations()

  await sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`
  try {
    await sql.begin(async (tx) => {
      await tx`CREATE SCHEMA IF NOT EXISTS drizzle`
      await tx`
        CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        )
      `

      const lastAppliedWhen = await assertMigrationStateHealthy(tx, migrations)
      const pending = migrations.filter((migration) => lastAppliedWhen === null || migration.when > lastAppliedWhen)

      if (pending.length === 0) {
        console.log('[Database] migrations are up to date')
        return
      }

      console.log(`[Database] applying ${pending.length} migration(s)`)
      for (const migration of pending) {
        for (const statement of migration.statements) await tx.unsafe(statement)
        await tx`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${migration.hash}, ${migration.when})
        `
        console.log(`[Database] applied ${migration.tag}`)
      }
    })
  } finally {
    await sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`.catch(() => undefined)
  }
}

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: process.env.DATABASE_DRIVER === 'neon' ? 'require' : false,
})

try {
  await waitForDatabase(sql)
  await runMigrations(sql)
  console.log('[Database] migration completed')
} finally {
  await sql.end()
}
