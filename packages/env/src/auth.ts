import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { parseEnvBoolean } from './helpers'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      /** Better Auth 启用的 SSO 提供商列表，使用逗号分隔；支持 `github`、`google`、`apple`、`wechat`、`feishu`。 */
      AUTH_SSO_PROVIDERS?: string
      /** Better Auth 会话签名密钥；生产环境必须配置随机密钥。 */
      AUTH_SECRET?: string
      /**
       * RS256 RSA key pair in JWKS JSON format for signing/verifying user JWTs.
       * Generate with: bun scripts/generate-jwks-key.ts
       */
      JWKS_KEY?: string
      /** 用户访问令牌有效期，格式为数字加 `s`、`m`、`h` 或 `d`；默认 `15m`。 */
      JWT_ACCESS_EXPIRATION?: string
      /** 用户刷新令牌有效期，格式为数字加 `s`、`m`、`h` 或 `d`；默认 `7d`。 */
      JWT_REFRESH_EXPIRATION?: string

      /** Apple OAuth 客户端 ID。 */
      AUTH_APPLE_CLIENT_ID?: string
      /** Apple OAuth 客户端密钥。 */
      AUTH_APPLE_CLIENT_SECRET?: string
      /** Apple OAuth 应用 Bundle ID。 */
      AUTH_APPLE_APP_BUNDLE_IDENTIFIER?: string

      /** 飞书 OAuth 应用 ID。 */
      AUTH_FEISHU_APP_ID?: string
      /** 飞书 OAuth 应用密钥。 */
      AUTH_FEISHU_APP_SECRET?: string

      /** GitHub OAuth 应用客户端 ID。 */
      AUTH_GITHUB_ID?: string
      /** GitHub OAuth 应用客户端密钥。 */
      AUTH_GITHUB_SECRET?: string

      /** Google OAuth 应用客户端 ID。 */
      AUTH_GOOGLE_ID?: string
      /** Google OAuth 应用客户端密钥。 */
      AUTH_GOOGLE_SECRET?: string

      /** 微信 OAuth 应用 ID。 */
      AUTH_WECHAT_ID?: string
      /** 微信 OAuth 应用密钥。 */
      AUTH_WECHAT_SECRET?: string

      /** GitHub App 客户端 ID。 */
      GITHUB_CLIENT_ID?: string
      /** GitHub App 客户端密钥。 */
      GITHUB_CLIENT_SECRET?: string
      /** Electron 客户端使用的 GitHub OAuth 客户端 ID。 */
      GITHUB_ELECTRON_ID?: string
      /** Electron 客户端使用的 GitHub OAuth 客户端密钥。 */
      GITHUB_ELECTRON_SECRET?: string

      /** 是否禁用邮箱密码注册；启用后仅允许 SSO 登录。 */
      AUTH_DISABLE_EMAIL_PASSWORD?: string
      /** 是否要求新用户完成邮箱验证后才能使用密码登录。 */
      AUTH_EMAIL_VERIFICATION?: string
      /** 邮箱验证方式：`otp`（验证码）或 `link`（邮件链接）；默认 `otp`。 */
      AUTH_EMAIL_VERIFICATION_MODE?: string
      /** 是否启用免密魔法链接登录。 */
      AUTH_ENABLE_MAGIC_LINK?: string
    }
  }
}

export const getAuthConfig = () => {
  return createEnv({
    server: {
      /** Better Auth 启用的 SSO 提供商列表，使用逗号分隔；默认不启用。 */
      AUTH_SSO_PROVIDERS: z.string().optional().default(''),

      /** Better Auth 会话签名密钥；生产环境必须配置随机密钥。 */
      AUTH_SECRET: z.string().optional(),

      /** 用于签名和验证用户 JWT 的 RS256 JWKS 密钥。 */
      JWKS_KEY: z.string().optional(),
      /** 用户访问令牌有效期；默认 `15m`。 */
      JWT_ACCESS_EXPIRATION: z.string().default('15m'),
      /** 用户刷新令牌有效期；默认 `7d`。 */
      JWT_REFRESH_EXPIRATION: z.string().default('7d'),

      /** Apple OAuth 客户端 ID。 */
      AUTH_APPLE_CLIENT_ID: z.string().optional(),
      /** Apple OAuth 客户端密钥。 */
      AUTH_APPLE_CLIENT_SECRET: z.string().optional(),
      /** Apple OAuth 应用 Bundle ID。 */
      AUTH_APPLE_APP_BUNDLE_IDENTIFIER: z.string().optional(),

      /** 飞书 OAuth 应用 ID。 */
      AUTH_FEISHU_APP_ID: z.string().optional(),
      /** 飞书 OAuth 应用密钥。 */
      AUTH_FEISHU_APP_SECRET: z.string().optional(),

      /** GitHub OAuth 应用客户端 ID。 */
      AUTH_GITHUB_ID: z.string().optional(),
      /** GitHub OAuth 应用客户端密钥。 */
      AUTH_GITHUB_SECRET: z.string().optional(),

      /** Google OAuth 应用客户端 ID。 */
      AUTH_GOOGLE_ID: z.string().optional(),
      /** Google OAuth 应用客户端密钥。 */
      AUTH_GOOGLE_SECRET: z.string().optional(),

      /** 微信 OAuth 应用 ID。 */
      AUTH_WECHAT_ID: z.string().optional(),
      /** 微信 OAuth 应用密钥。 */
      AUTH_WECHAT_SECRET: z.string().optional(),

      /** GitHub App 客户端 ID。 */
      GITHUB_CLIENT_ID: z.string().optional(),
      /** GitHub App 客户端密钥。 */
      GITHUB_CLIENT_SECRET: z.string().optional(),
      /** Electron 客户端使用的 GitHub OAuth 客户端 ID。 */
      GITHUB_ELECTRON_ID: z.string().optional(),
      /** Electron 客户端使用的 GitHub OAuth 客户端密钥。 */
      GITHUB_ELECTRON_SECRET: z.string().optional(),

      /** 是否禁用邮箱密码注册；默认关闭。 */
      AUTH_DISABLE_EMAIL_PASSWORD: z.boolean().optional().default(false),
      /** 是否要求新用户完成邮箱验证；默认关闭。 */
      AUTH_EMAIL_VERIFICATION: z.boolean().optional().default(false),
      /** 邮箱验证方式：`otp` 或 `link`；默认 `otp`。 */
      AUTH_EMAIL_VERIFICATION_MODE: z.enum(['otp', 'link']).optional().default('otp'),
      /** 是否启用免密魔法链接登录；默认关闭。 */
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

      AUTH_DISABLE_EMAIL_PASSWORD: parseEnvBoolean(process.env.AUTH_DISABLE_EMAIL_PASSWORD),
      AUTH_EMAIL_VERIFICATION: parseEnvBoolean(process.env.AUTH_EMAIL_VERIFICATION),
      AUTH_EMAIL_VERIFICATION_MODE: process.env.AUTH_EMAIL_VERIFICATION_MODE === 'link' ? 'link' : 'otp',
      AUTH_ENABLE_MAGIC_LINK: parseEnvBoolean(process.env.AUTH_ENABLE_MAGIC_LINK),
    },
  })
}

export const authEnv = getAuthConfig()
