import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const getServerDBConfig = () => {
  return createEnv({
    client: {
      /**
       * 控制是否启用服务器端服务
       */
      NEXT_PUBLIC_ENABLED_SERVER_SERVICE: z.boolean(),
    },
    server: {
      DATABASE_DRIVER: z.enum(["neon", "node"]),
      DATABASE_TEST_URL: z.string().optional(),
      /**
       * Postgres 数据库连接字符串
       */
      DATABASE_URL: z.string().optional(),
      /**
       * 加密敏感信息的密钥
       */
      KEY_VAULTS_SECRET: z.string().optional(),
    },
    runtimeEnv: {
      DATABASE_DRIVER: process.env.DATABASE_DRIVER || "neon",
      DATABASE_TEST_URL: process.env.DATABASE_TEST_URL,
      DATABASE_URL: process.env.DATABASE_URL,

      KEY_VAULTS_SECRET: process.env.KEY_VAULTS_SECRET,

      NEXT_PUBLIC_ENABLED_SERVER_SERVICE:
        process.env.NEXT_PUBLIC_SERVICE_MODE === "server",
    },
  });
};

export const serverDBEnv = getServerDBConfig();
