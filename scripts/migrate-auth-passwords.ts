import { and, eq, isNotNull } from 'drizzle-orm'

import { account, users } from '../src/database/schemas'
import { migrateStoredPasswordToAccount } from '../src/libs/better-auth/legacy-password'

import { createMigrationClient } from './lib/db'

const CREDENTIAL_PROVIDER = 'credential'

const runMigrateAuthPasswords = async () => {
  const { connection, db } = createMigrationClient()

  console.log('⏳ 开始迁移 users.password → accounts...')

  const candidates = await db
    .select({
      email: users.email,
      id: users.id,
      password: users.password,
    })
    .from(users)
    .where(and(isNotNull(users.email), isNotNull(users.password)))

  let created = 0
  let skipped = 0
  let failed = 0

  for (const user of candidates) {
    const email = user.email!.trim().toLowerCase()
    const storedPassword = user.password?.trim()

    if (!storedPassword) {
      skipped += 1
      continue
    }

    const [existingAccount] = await db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, user.id), eq(account.providerId, CREDENTIAL_PROVIDER)))
      .limit(1)

    if (existingAccount) {
      console.log(`⏭️  跳过（已有 credential 账户）: ${email}`)
      skipped += 1
      continue
    }

    try {
      const migratedPassword = await migrateStoredPasswordToAccount(storedPassword)

      await db.insert(account).values({
        accountId: email,
        createdAt: new Date(),
        id: crypto.randomUUID(),
        password: migratedPassword,
        providerId: CREDENTIAL_PROVIDER,
        updatedAt: new Date(),
        userId: user.id,
      })

      console.log(`✅ 已迁移: ${email}`)
      created += 1
    } catch (error) {
      console.error(`❌ 迁移失败: ${email}`, error)
      failed += 1
    }
  }

  await connection.end()

  console.log('\n迁移完成')
  console.log(`  创建: ${created}`)
  console.log(`  跳过: ${skipped}`)
  console.log(`  失败: ${failed}`)

  if (failed > 0) {
    process.exit(1)
  }

  process.exit(0)
}

runMigrateAuthPasswords().catch((error) => {
  console.error('❌ 迁移脚本执行失败')
  console.error(error)
  process.exit(1)
})
