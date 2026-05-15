import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { serverDBEnv } from '@/envs/serverDB';

import type { ChatDatabase } from '../type';
import * as schema from '../schemas';

export const getDBInstance = (): ChatDatabase => {
  const { DATABASE_URL, DATABASE_DRIVER } = serverDBEnv;

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL 环境变量未设置。请检查您的.env文件。");
  }

  try {
    const client = postgres(DATABASE_URL, {
      ssl: DATABASE_DRIVER === "neon" ? "require" : false,
    });
    const db = drizzle(client, { schema });

    return db;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    throw error;
  }
}
