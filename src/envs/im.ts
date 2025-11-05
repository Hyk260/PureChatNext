import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      IM_SDK_APPID?: string;
      IM_SDK_KEY?: string;
      IM_ADMIN_ISTRATOR?: string;
      IM_SERVER_BASE_URL?: string;
      IM_REQUEST_TIMEOUT?: string;
    }
  }
}

export const getIMConfig = () => {
  return createEnv({
    client: {},
    server: {
      IM_SDK_APPID: z.string().optional(),
      IM_SDK_KEY: z.string().optional(),
      IM_ADMIN_ISTRATOR: z.string().optional(),
      IM_SERVER_BASE_URL: z.string().optional(),
      IM_REQUEST_TIMEOUT: z.string().optional(),
    },
    runtimeEnv: {
      IM_REQUEST_TIMEOUT: process.env.IM_REQUEST_TIMEOUT,
      IM_SERVER_BASE_URL: process.env.IM_SERVER_BASE_URL,
      IM_ADMIN_ISTRATOR: process.env.IM_ADMIN_ISTRATOR,
      IM_SDK_APPID: process.env.IM_SDK_APPID,
      IM_SDK_KEY: process.env.IM_SDK_KEY,
    },
  });
};

export const imEnv = getIMConfig();


