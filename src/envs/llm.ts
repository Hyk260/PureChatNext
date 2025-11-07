import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const getLLMConfig = () => {
  return createEnv({
    server: {
      /**
       * 用于控制多个 API Keys 时，选择 Key 的模式，当前支持 `random` 和 `turn`
       */
      API_KEY_SELECT_MODE: z.string().optional(),

      ENABLED_OPENAI: z.boolean(),
      OPENAI_API_KEY: z.string().optional(),

      ENABLED_DEEPSEEK: z.boolean(),
      DEEPSEEK_API_KEY: z.string().optional(),

    },
    runtimeEnv: {
      API_KEY_SELECT_MODE: process.env.API_KEY_SELECT_MODE,

      ENABLED_OPENAI: process.env.ENABLED_OPENAI !== "0",
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,

      ENABLED_DEEPSEEK: !!process.env.DEEPSEEK_API_KEY,
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,

    },
  });
};

export const llmEnv = getLLMConfig();
