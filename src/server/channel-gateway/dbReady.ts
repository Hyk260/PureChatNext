import { sql } from 'drizzle-orm'

import { serverDB } from '@pure/database/core/db-adaptor'

/** 探测 PostgreSQL 是否可连接，失败时不抛错（避免启动期刷屏）。 */
export async function pingDatabase(): Promise<boolean> {
  try {
    await serverDB.execute(sql`SELECT 1`)
    return true
  } catch {
    return false
  }
}
