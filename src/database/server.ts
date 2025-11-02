import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// 加载环境变量
config({
  path: ".env.local",
});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set. Please check your .env.local file.");
}

// 创建连接
const connection = postgres(process.env.DATABASE_URL);

// 导出数据库实例
export const serverDB = drizzle(connection);

// 关闭连接（如果需要）
if (typeof window === "undefined") {
  process.on("exit", () => {
    connection.end();
  });
}

