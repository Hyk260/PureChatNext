import "server-only";

import { config } from "dotenv";
import {
  asc,
  eq,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverDBEnv } from "@/envs/serverDB";
import {
  type User,
  user,
} from "./schema";
import { generateHashedPassword, verifyPassword } from "./utils";

config();

// 如果不使用邮箱/密码登录，可以使用适用于Auth.js/NextAuth的Drizzle适配器
// https://authjs.dev/reference/adapter/drizzle

if (!serverDBEnv.DATABASE_URL) {
  throw new Error("未设置 DATABASE_URL 环境变量。请检查您的.env文件。");
}

const client = postgres(serverDBEnv.DATABASE_URL);
const db = drizzle(client);

/**
 * 根据邮箱获取用户
 */
export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email)).limit(1);
  } catch (error) {
    console.error("Error getting user by email:", error);
    throw error;
  }
}

/**
 * 通过邮箱和密码查询用户信息（返回不包含密码的数据）
 */
export async function getUserByEmailAndPassword(
  email: string,
  password: string
): Promise<Omit<User, "password"> | null> {
  try {
    const users = await db.select().from(user).where(eq(user.email, email)).limit(1);
    
    if (users.length === 0) {
      return null;
    }

    const foundUser = users[0];
    
    // 验证密码
    if (!foundUser.password || !verifyPassword(password, foundUser.password)) {
      return null;
    }

    // 返回不包含密码的用户信息
    const userWithoutPassword: Omit<User, "password"> = {
      id: foundUser.id,
      email: foundUser.email,
      login_id: foundUser.login_id,
      nick_name: foundUser.nick_name,
      avatar_url: foundUser.avatar_url,
      phone: foundUser.phone,
      created_at: foundUser.created_at,
      updated_at: foundUser.updated_at,
    };
    return userWithoutPassword;
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
    const result = await db.select().from(user).where(eq(user.login_id, loginId)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("Error getting user by login_id:", error);
    throw error;
  }
}

/**
 * 通过 login_id 和密码查询用户信息（返回不包含密码的数据）
 */
export async function getUserByLoginIdAndPassword(
  loginId: string,
  password: string
): Promise<Omit<User, "password"> | null> {
  try {
    const users = await db.select().from(user).where(eq(user.login_id, loginId)).limit(1);
    
    if (users.length === 0) {
      return null;
    }

    const foundUser = users[0];
    
    // 验证密码
    if (!foundUser.password || !verifyPassword(password, foundUser.password)) {
      return null;
    }

    // 返回不包含密码的用户信息
    const userWithoutPassword: Omit<User, "password"> = {
      id: foundUser.id,
      email: foundUser.email,
      login_id: foundUser.login_id,
      nick_name: foundUser.nick_name,
      avatar_url: foundUser.avatar_url,
      phone: foundUser.phone,
      created_at: foundUser.created_at,
      updated_at: foundUser.updated_at,
    };
    return userWithoutPassword;
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
