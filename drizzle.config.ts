import { type Config } from 'drizzle-kit'

import './scripts/lib/load-env'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('缺少 `DATABASE_URL` 环境变量')
}

export default {
  dbCredentials: {
    url: connectionString,
  },
  dialect: 'postgresql',
  out: './packages/database/src/migrations',
  schema: './packages/database/src/schemas',
  strict: true,
} satisfies Config
