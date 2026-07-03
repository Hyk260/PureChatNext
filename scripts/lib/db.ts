import './load-env';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { serverDBEnv } from '@/envs/serverDB';

export function createMigrationClient() {
  const { DATABASE_URL, DATABASE_DRIVER } = serverDBEnv;

  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL 未定义');
  }

  const connection = postgres(DATABASE_URL, {
    max: 1,
    ssl: DATABASE_DRIVER === 'neon' ? 'require' : false,
  });

  return { connection, db: drizzle(connection) };
}
