import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import type * as schema from './schemas';

export type ChatDatabaseSchema = typeof schema;

export type ChatDatabase = PostgresJsDatabase<ChatDatabaseSchema>;

export type Transaction = Parameters<Parameters<ChatDatabase['transaction']>[0]>[0];
