import "server-only";

import { config } from "dotenv";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverDBEnv } from "@/envs/serverDB";
import { user } from "./schema";
import { generateHashedPassword, verifyPassword } from "./utils";

import type { User } from "./schema";

config();

// 如果不使用邮箱/密码登录，可以使用适用于Auth.js/NextAuth的Drizzle适配器
// https://authjs.dev/reference/adapter/drizzle

if (!serverDBEnv.DATABASE_URL) {
  throw new Error("未设置 DATABASE_URL 环境变量。请检查您的.env文件。");
}

const client = postgres(serverDBEnv.DATABASE_URL);
const db = drizzle(client);

export type UserWithoutPassword = Omit<User, "password">;

export const excludePassword = (user: User): UserWithoutPassword => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

/**
 * 检查邮箱是否已存在
 */
export async function isEmailExists(email: string): Promise<boolean> {
  const existingUser = await getUserByEmail(email);
  return existingUser !== null;
}

/**
 * 检查 login_id 是否已存在
 */
export async function isLoginIdExists(loginId: string): Promise<boolean> {
  const existingUser = await getUserByLoginId(loginId);
  return existingUser !== null;
}

/**
 * 根据邮箱获取用户
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const result = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("Error getting user by email:", error);
    throw error;
  }
}

/**
 * 通过邮箱和密码验证用户
 */
export async function getUserByEmailAndPassword(
  email: string,
  password: string
): Promise<UserWithoutPassword | null> {
  try {
    const foundUser = await getUserByEmail(email);
    
    if (!foundUser?.password || !verifyPassword(password, foundUser.password)) {
      return null;
    }

    return excludePassword(foundUser);
  } catch (error) {
    console.error("Error getting user by email and password:", error);
    throw error;
  }
}

/**
 * 根据 login_id 获取用户
 */
export async function getUserByLoginId(loginId: string): Promise<User | null> {
  try {
    const result = await db
      .select()
      .from(user)
      .where(eq(user.login_id, loginId))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("Error getting user by login_id:", error);
    throw error;
  }
}

/**
 * 通过 login_id 和密码验证用户
 */
export async function getUserByLoginIdAndPassword(
  loginId: string,
  password: string
): Promise<UserWithoutPassword | null> {
  try {
    const foundUser = await getUserByLoginId(loginId);

    if (!foundUser?.password || !verifyPassword(password, foundUser.password)) {
      return null;
    }

    return excludePassword(foundUser);
  } catch (error) {
    console.error("Error getting user by login_id and password:", error);
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
export async function createUser(
  email: string,
  password: string,
  loginId: string
): Promise<User> {
  const hashedPassword = generateHashedPassword(password);
  try {
    const result = await db
      .insert(user)
      .values({ email, password: hashedPassword, login_id: loginId })
      .returning();
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
