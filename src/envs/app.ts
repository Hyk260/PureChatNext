import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

import { isServerMode } from '@/const/version';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      ACCESS_CODE?: string;
    }
  }
}

const isInVercel = process.env.VERCEL === '1';

const vercelUrl = `https://${process.env.VERCEL_URL}`;

const APP_URL = process.env.APP_URL ? process.env.APP_URL : isInVercel ? vercelUrl : undefined;

// 仅在服务器模式和服务器端抛出错误
if (typeof window === 'undefined' && isServerMode && !APP_URL) {
  throw new Error('`APP_URL` is required in server mode');
}

export const getAppConfig = () => {
  // const ACCESS_CODES = process.env.ACCESS_CODE?.split(',').filter(Boolean) || [];

  return createEnv({
    client: {
      NEXT_PUBLIC_ENABLE_SENTRY: z.boolean(),
    },
    server: {
      APP_URL: z.string().optional(),
      VERCEL_EDGE_CONFIG: z.string().optional(),
    },
    runtimeEnv: {
      // Sentry
      NEXT_PUBLIC_ENABLE_SENTRY: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      VERCEL_EDGE_CONFIG: process.env.VERCEL_EDGE_CONFIG,
      APP_URL,
    },
  });
};

export const appEnv = getAppConfig();
