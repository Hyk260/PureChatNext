import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

import { parseEnvBoolean } from './helpers';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      /** 是否启用 Vercel Analytics */
      ENABLE_VERCEL_ANALYTICS?: string
      /** Vercel Analytics 调试模式 */
      DEBUG_VERCEL_ANALYTICS?: string
      /** React Scan Monitor API Key，用于监控 React 应用性能（https://dashboard.react-scan.com） */
      REACT_SCAN_MONITOR_API_KEY?: string
    }
  }
}

export const getAnalyticsConfig = () => {
  return createEnv({
    server: {
      ENABLE_VERCEL_ANALYTICS: z.boolean(),
      DEBUG_VERCEL_ANALYTICS: z.boolean(),

      REACT_SCAN_MONITOR_API_KEY: z.string().optional(),
    },
    runtimeEnv: {
      // Vercel Analytics
      ENABLE_VERCEL_ANALYTICS: parseEnvBoolean(process.env.ENABLE_VERCEL_ANALYTICS),
      DEBUG_VERCEL_ANALYTICS: parseEnvBoolean(process.env.DEBUG_VERCEL_ANALYTICS),

      // React Scan Monitor
      REACT_SCAN_MONITOR_API_KEY: process.env.REACT_SCAN_MONITOR_API_KEY,
    },
  });
};

export const analyticsEnv = getAnalyticsConfig();
