import "server-only";

import { config } from "dotenv";
import {
  asc,
  eq,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  type User,
  user,
} from "./schema";
import { generateHashedPassword } from "./utils";

// 加载环境变量
config({
  path: ".env.local",
});

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set. Please check your .env.local file.");
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

/**
 * 根据邮箱获取用户
 */
export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    console.error("Error getting user by email:", error);
    throw error;
  }
}

/**
 * 根据 ID 获取用户
 */
export async function getUserById(id: string): Promise<User | null> {
  try {
    const result = await db.select().from(user).where(eq(user.id, id)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("Error getting user by id:", error);
    throw error;
  }
}

/**
 * 获取所有用户
 */
export async function getAllUsers(): Promise<User[]> {
  try {
    return await db.select().from(user).orderBy(asc(user.email));
  } catch (error) {
    console.error("Error getting all users:", error);
    throw error;
  }
}

/**
 * 创建用户
 */
export async function createUser(email: string, password: string): Promise<User> {
  const hashedPassword = generateHashedPassword(password);

  try {
    const result = await db.insert(user).values({ email, password: hashedPassword }).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
}

/**
 * 更新用户
 */
export async function updateUser(
  id: string,
  updates: { email?: string; password?: string }
): Promise<User | null> {
  try {
    const updateData: { email?: string; password?: string } = {};
    
    if (updates.email) {
      updateData.email = updates.email;
    }
    
    if (updates.password) {
      updateData.password = generateHashedPassword(updates.password);
    }

    if (Object.keys(updateData).length === 0) {
      return await getUserById(id);
    }

    const result = await db
      .update(user)
      .set(updateData)
      .where(eq(user.id, id))
      .returning();
    
    return result[0] || null;
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
}

/**
 * 删除用户
 */
export async function deleteUser(id: string): Promise<boolean> {
  try {
    const result = await db.delete(user).where(eq(user.id, id)).returning();
    return result.length > 0;
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}
