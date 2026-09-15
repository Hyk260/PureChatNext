import './load-env'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

export function createMigrationClient() {
  const databaseUrl = process.env.DATABASE_URL
  const databaseDriver = process.env.DATABASE_DRIVER || 'neon'

  if (!databaseUrl) {
    throw new Error('DATABASE_URL 未定义')
  }

  const connection = postgres(databaseUrl, {
    max: 1,
    ssl: databaseDriver === 'neon' ? 'require' : false,
  })

  return { connection, db: drizzle(connection) }
}
