import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      /**
       * RS256 RSA key pair in JWKS JSON format for signing/verifying user JWTs.
       * Generate with: node scripts/generate-jwks-key.mjs
       */
      JWKS_KEY?: string;
      JWT_ACCESS_EXPIRATION?: string;
      JWT_REFRESH_EXPIRATION?: string;

      AUTH_APPLE_CLIENT_ID?: string;
      AUTH_APPLE_CLIENT_SECRET?: string;
      AUTH_APPLE_APP_BUNDLE_IDENTIFIER?: string;

      AUTH_FEISHU_APP_ID?: string;
      AUTH_FEISHU_APP_SECRET?: string;

      AUTH_GITHUB_ID?: string;
      AUTH_GITHUB_SECRET?: string;

      AUTH_GOOGLE_ID?: string;
      AUTH_GOOGLE_SECRET?: string;

      AUTH_WECHAT_ID?: string;
      AUTH_WECHAT_SECRET?: string;

      GITHUB_CLIENT_ID?: string;
      GITHUB_CLIENT_SECRET?: string;
      GITHUB_ELECTRON_ID?: string;
      GITHUB_ELECTRON_SECRET?: string;

      AUTH_DISABLE_EMAIL_PASSWORD?: string;
      AUTH_EMAIL_VERIFICATION?: string;
      AUTH_EMAIL_VERIFICATION_MODE?: string;
      AUTH_ENABLE_MAGIC_LINK?: string;
    }
  }
}

export const getAuthConfig = () => {
  return createEnv({
    server: {
      AUTH_SSO_PROVIDERS: z.string().optional().default(''),

      AUTH_SECRET: z.string().optional(),

      JWKS_KEY: z.string().optional(),
      JWT_ACCESS_EXPIRATION: z.string().default('15m'),
      JWT_REFRESH_EXPIRATION: z.string().default('7d'),

      AUTH_APPLE_CLIENT_ID: z.string().optional(),
      AUTH_APPLE_CLIENT_SECRET: z.string().optional(),
      AUTH_APPLE_APP_BUNDLE_IDENTIFIER: z.string().optional(),

      AUTH_FEISHU_APP_ID: z.string().optional(),
      AUTH_FEISHU_APP_SECRET: z.string().optional(),

      AUTH_GITHUB_ID: z.string().optional(),
      AUTH_GITHUB_SECRET: z.string().optional(),

      AUTH_GOOGLE_ID: z.string().optional(),
      AUTH_GOOGLE_SECRET: z.string().optional(),

      AUTH_WECHAT_ID: z.string().optional(),
      AUTH_WECHAT_SECRET: z.string().optional(),

      GITHUB_CLIENT_ID: z.string().optional(),
      GITHUB_CLIENT_SECRET: z.string().optional(),
      GITHUB_ELECTRON_ID: z.string().optional(),
      GITHUB_ELECTRON_SECRET: z.string().optional(),

      AUTH_DISABLE_EMAIL_PASSWORD: z.boolean().optional().default(false),
      AUTH_EMAIL_VERIFICATION: z.boolean().optional().default(false),
      AUTH_EMAIL_VERIFICATION_MODE: z.enum(['otp', 'link']).optional().default('otp'),
      AUTH_ENABLE_MAGIC_LINK: z.boolean().optional().default(false),
    },
    runtimeEnv: {
      AUTH_SSO_PROVIDERS: process.env.AUTH_SSO_PROVIDERS,

      AUTH_SECRET: process.env.AUTH_SECRET,

      JWKS_KEY: process.env.JWKS_KEY,
      JWT_ACCESS_EXPIRATION: process.env.JWT_ACCESS_EXPIRATION,
      JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION,

      // Apple 配置
      AUTH_APPLE_CLIENT_ID: process.env.AUTH_APPLE_CLIENT_ID,
      AUTH_APPLE_CLIENT_SECRET: process.env.AUTH_APPLE_CLIENT_SECRET,
      AUTH_APPLE_APP_BUNDLE_IDENTIFIER: process.env.AUTH_APPLE_APP_BUNDLE_IDENTIFIER,

      // Feishu 配置
      AUTH_FEISHU_APP_ID: process.env.AUTH_FEISHU_APP_ID,
      AUTH_FEISHU_APP_SECRET: process.env.AUTH_FEISHU_APP_SECRET,

      // GitHub 配置
      AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID,
      AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET,

      // Google 配置
      AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
      AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,

      // Wechat 配置  
      AUTH_WECHAT_ID: process.env.AUTH_WECHAT_ID,
      AUTH_WECHAT_SECRET: process.env.AUTH_WECHAT_SECRET,

      // GitHub 客户端配置  
      GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
      GITHUB_ELECTRON_ID: process.env.GITHUB_ELECTRON_ID,
      GITHUB_ELECTRON_SECRET: process.env.GITHUB_ELECTRON_SECRET,

      AUTH_DISABLE_EMAIL_PASSWORD: process.env.AUTH_DISABLE_EMAIL_PASSWORD === '1',
      AUTH_EMAIL_VERIFICATION: process.env.AUTH_EMAIL_VERIFICATION === '1',
      AUTH_EMAIL_VERIFICATION_MODE:
        process.env.AUTH_EMAIL_VERIFICATION_MODE === 'link' ? 'link' : 'otp',
      AUTH_ENABLE_MAGIC_LINK: process.env.AUTH_ENABLE_MAGIC_LINK === '1',
    },
  });
};

export const authEnv = getAuthConfig();