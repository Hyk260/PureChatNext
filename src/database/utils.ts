import { createHash } from "node:crypto";

/**
 * 生成哈希密码
 * 注意：生产环境建议使用 bcrypt 或 argon2 等更安全的哈希算法
 */
export function generateHashedPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

/**
 * 验证密码
 */
export function verifyPassword(password: string, hashedPassword: string): boolean {
  const hash = generateHashedPassword(password);
  return (hash === hashedPassword || password === hashedPassword);
}

