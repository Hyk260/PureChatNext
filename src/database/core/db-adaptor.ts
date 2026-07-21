import "server-only";

import { type ChatDatabase } from '../type';
import { getDBInstance } from './web-server';

let cachedDB: ChatDatabase | null = null;

export const getServerDB = (): ChatDatabase => {
  if (cachedDB) return cachedDB;

  try {
    cachedDB = getDBInstance();
    return cachedDB;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    throw error;
  }
};

export const serverDB = getDBInstance();