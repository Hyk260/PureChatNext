import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import type postgres from 'postgres'

interface JournalEntry {
  tag: string
  when: number
}

interface Journal {
  entries: JournalEntry[]
}

export interface MigrationFileMeta {
  hash: string
  tag: string
  when: number
}

export interface MigrationSummary {
  lastAppliedWhen: number | null
  pendingCount: number
  pendingTags: string[]
}

interface DbMigrationRecord {
  created_at: string
  hash: string
}

const SHA256_HEX_LENGTH = 64

function readJournalMigrations(migrationsFolder: string): MigrationFileMeta[] {
  const journalPath = path.join(migrationsFolder, 'meta/_journal.json')

  if (!fs.existsSync(journalPath)) {
    throw new Error(`找不到迁移 journal：${journalPath}`)
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as Journal

  return journal.entries.map((entry) => {
    const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`)
    const sql = fs.readFileSync(sqlPath, 'utf8')
    const hash = createHash('sha256').update(sql).digest('hex')

    return { hash, tag: entry.tag, when: entry.when }
  })
}

async function getLastDbMigration(connection: postgres.Sql): Promise<DbMigrationRecord | null> {
  const rows = await connection<
    DbMigrationRecord[]
  >`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1`

  return rows[0] ?? null
}

async function tableExists(connection: postgres.Sql, tableName: string): Promise<boolean> {
  const rows = await connection<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${tableName}
    ) AS exists
  `

  return rows[0]?.exists ?? false
}

export async function getMigrationSummary(
  connection: postgres.Sql,
  migrationsFolder: string
): Promise<MigrationSummary> {
  const journalMigrations = readJournalMigrations(migrationsFolder)
  const lastDbMigration = await getLastDbMigration(connection)
  const lastAppliedWhen = lastDbMigration ? Number(lastDbMigration.created_at) : null

  const pendingTags = journalMigrations
    .filter((migration) => lastAppliedWhen === null || lastAppliedWhen < migration.when)
    .map((migration) => migration.tag)

  return {
    lastAppliedWhen,
    pendingCount: pendingTags.length,
    pendingTags,
  }
}

export async function assertMigrationStateHealthy(connection: postgres.Sql, migrationsFolder: string): Promise<void> {
  const journalMigrations = readJournalMigrations(migrationsFolder)

  if (journalMigrations.length === 0) {
    return
  }

  const lastDbMigration = await getLastDbMigration(connection)
  const usersExists = await tableExists(connection, 'users')
  const firstJournalWhen = journalMigrations[0]!.when

  if (lastDbMigration && lastDbMigration.hash.length !== SHA256_HEX_LENGTH) {
    throw new Error(
      [
        '迁移状态异常：`drizzle.__drizzle_migrations.hash` 不是有效的 SHA256 哈希。',
        `当前值：${lastDbMigration.hash}`,
        '请勿手动写入迁移 tag 名；应写入对应 .sql 文件的 SHA256 哈希与 journal 中的 when 时间戳。',
        '请参考 docs/drizzle-setup.zh-CN.md#迁移失败 修复迁移记录后再执行。',
      ].join('\n')
    )
  }

  const lastAppliedWhen = lastDbMigration ? Number(lastDbMigration.created_at) : null

  const willRerunFromStart = lastAppliedWhen === null || lastAppliedWhen === 0 || lastAppliedWhen < firstJournalWhen

  if (willRerunFromStart && usersExists) {
    throw new Error(
      [
        '迁移状态异常：数据库已有 users 表，但 Drizzle 认为尚未应用任何迁移。',
        lastDbMigration
          ? `当前 __drizzle_migrations.created_at=${lastDbMigration.created_at}`
          : '当前 __drizzle_migrations 为空。',
        '这通常由手动写入错误的迁移记录引起，会导致重复 CREATE TABLE 失败。',
        '请参考 docs/drizzle-setup.zh-CN.md#迁移失败 修复迁移记录后再执行。',
      ].join('\n')
    )
  }

  if (lastAppliedWhen !== null && journalMigrations.length >= 2 && usersExists) {
    const secondLastWhen = journalMigrations[journalMigrations.length - 2]!.when

    if (lastAppliedWhen < secondLastWhen) {
      console.warn(
        [
          '⚠️  迁移记录可能不完整：',
          `__drizzle_migrations.created_at=${lastAppliedWhen}，`,
          `但 journal 中已有 ${journalMigrations.length} 条迁移。`,
          '若后续迁移失败，请检查迁移记录是否与 journal 对齐。',
        ].join('')
      )
    }
  }
}
