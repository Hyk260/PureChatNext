import path from 'node:path'
import { fileURLToPath } from 'node:url'

import debug from 'debug'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

import './lib/load-env'

import { assertMigrationStateHealthy, getMigrationSummary } from './lib/check-migration-state'
import { createMigrationClient } from './lib/db'

const log = debug('db:migrate')

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '../packages/database/src/migrations')

async function runMigrate() {
  const { connection, db } = createMigrationClient()

  try {
    await assertMigrationStateHealthy(connection, migrationsFolder)

    const before = await getMigrationSummary(connection, migrationsFolder)
    log('迁移前状态: %O', before)

    if (before.pendingCount > 0) {
      console.log(`⏳ 运行迁移... (待执行 ${before.pendingCount} 条)`)
      console.log(`  ${before.pendingTags.join(', ')}`)
    } else {
      console.log('⏳ 运行迁移... (无待执行)')
    }

    const start = Date.now()
    await migrate(db, { migrationsFolder })
    const elapsed = Date.now() - start

    const after = await getMigrationSummary(connection, migrationsFolder)
    log('迁移后状态: %O', after)

    console.log(`✅ 迁移已完成，用时 ${elapsed} ms`)

    const newlyApplied = before.pendingTags.filter((tag) => !after.pendingTags.includes(tag))

    if (newlyApplied.length > 0) {
      console.log(`  新应用: ${newlyApplied.join(', ')}`)
    }
  } finally {
    await connection.end()
  }
}

runMigrate().catch((error) => {
  console.error('❌ 迁移失败')
  console.error(error)
  process.exit(1)
})
