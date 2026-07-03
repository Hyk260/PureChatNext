import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const getAnalyticsConfig = () => {
  return createEnv({
    server: {
      ENABLE_VERCEL_ANALYTICS: z.boolean(),
      DEBUG_VERCEL_ANALYTICS: z.boolean(),

      REACT_SCAN_MONITOR_API_KEY: z.string().optional(),
    },
    runtimeEnv: {
      // Vercel Analytics
      ENABLE_VERCEL_ANALYTICS: process.env.ENABLE_VERCEL_ANALYTICS === '1',
      DEBUG_VERCEL_ANALYTICS: process.env.DEBUG_VERCEL_ANALYTICS === '1',

      // React Scan Monitor
      // https://dashboard.react-scan.com
      REACT_SCAN_MONITOR_API_KEY: process.env.REACT_SCAN_MONITOR_API_KEY,
    },
  });
};

export const analyticsEnv = getAnalyticsConfig();
