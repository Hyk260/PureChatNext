import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      ACCESS_CODE?: string;
      ALLOWED_ORIGINS?: string;
    }
  }
}

const isInVercel = process.env.VERCEL === '1';

const vercelUrl = `https://${process.env.VERCEL_URL}`;

const APP_URL = process.env.APP_URL ? process.env.APP_URL : isInVercel ? vercelUrl : undefined;

const isServerMode = process.env.NEXT_PUBLIC_SERVICE_MODE === 'server';

if (typeof window === 'undefined' && isServerMode && !APP_URL) {
  throw new Error('`APP_URL` is required in server mode');
}

export const getAppConfig = () => {
  return createEnv({
    clientPrefix: 'NEXT_PUBLIC_',
    client: {
      NEXT_PUBLIC_ENABLE_SENTRY: z.boolean(),
    },
    server: {
      APP_URL: z.string().optional(),
      VERCEL_EDGE_CONFIG: z.string().optional(),
      ALLOWED_ORIGINS: z.string().optional(),
    },
    runtimeEnv: {
      NEXT_PUBLIC_ENABLE_SENTRY: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      VERCEL_EDGE_CONFIG: process.env.VERCEL_EDGE_CONFIG,
      APP_URL,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    },
  });
};

export const appEnv = getAppConfig();