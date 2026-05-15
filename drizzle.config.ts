import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// 如果存在.env文件，则读取该文件，或者读取由指定的文件

// 传递给Node.js的dotenv_config_path参数

config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("缺少 `DATABASE_URL` 环境变量");
}

export default {
  dbCredentials: {
    url: connectionString,
  },
  dialect: "postgresql",
  out: "./src/database/migrations",
  schema: "./src/database/schemas",
  strict: true,
} satisfies Config;
