import { createNanoId, generateCompactUuid } from '@pure/utils'
import { betterAuth } from 'better-auth/minimal'
import type { BetterAuthOptions } from 'better-auth/minimal'
import { verifyPassword } from 'better-auth/crypto'
import { EmailService } from '@/server/services/email'
import type { EmailPayload } from '@/server/services/email/impls'
// import { imAccountPlugin } from '@/libs/better-auth/server/plugins/im-account'
import { admin, emailOTP, genericOAuth, magicLink } from 'better-auth/plugins'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import * as schema from '@pure/database/schemas'
import { serverDB } from '@pure/database/core/db-adaptor'
import { generateAuthUserId } from '@pure/database/utils/idGenerator'
import debug from 'debug'

import {
  getChangeEmailVerificationTemplate,
  getMagicLinkEmailTemplate,
  getResetPasswordEmailTemplate,
  getVerificationEmailTemplate,
  getVerificationOTPEmailTemplate,
} from '@/libs/better-auth/email-templates'
import { OTP_EXPIRES_IN } from '@/libs/better-auth/shared'
import { initBetterAuthSSOProviders, parseSSOProviders } from '@/libs/better-auth/sso'
import { createSecondaryStorage } from './server/create-secondary-storage'
import { createVerificationDailyRateLimitStorage } from './server/rate-limit-storage'

const log = debug('better-auth:define-config')

import { appEnv } from '@/envs/app'
import { authEnv } from '@/envs/auth'
import { getAllowedOrigins } from '@/libs/utils/allowed-origins'

const enabledSSOProviders = parseSSOProviders(authEnv.AUTH_SSO_PROVIDERS)
const { socialProviders, genericOAuthProviders } = initBetterAuthSSOProviders()

const VERIFICATION_LINK_EXPIRES_IN = 600
const MAGIC_LINK_EXPIRES_IN = 900
const enableMagicLink = authEnv.AUTH_ENABLE_MAGIC_LINK
const useOtpEmailVerification = authEnv.AUTH_EMAIL_VERIFICATION_MODE === 'otp'

/** 邮件类 Auth 端点限流：60 秒窗口内最多 1 次请求 */
const EMAIL_ENDPOINT_RATE_LIMIT = { max: 1, window: 60 }

async function sendAuthEmail(to: string, template: Pick<EmailPayload, 'html' | 'subject' | 'text'>) {
  await new EmailService().sendMail({ to, ...template })
}

function buildOptionalAuthPlugins() {
  const plugins = []

  if (useOtpEmailVerification) {
    plugins.push(
      emailOTP({
        // 一次性密码的允许尝试次数
        allowedAttempts: 3,
        // 一次性密码的过期时间
        expiresIn: OTP_EXPIRES_IN,
        // 一次性密码的长度
        otpLength: 6,
        // 注册验证由 verify-email 页手动触发 OTP 发送
        sendVerificationOnSignUp: false,
        async sendVerificationOTP({ email, otp }) {
          await sendAuthEmail(
            email,
            getVerificationOTPEmailTemplate({
              expiresInSeconds: OTP_EXPIRES_IN,
              otp,
              userName: null,
            })
          )
        },
      })
    )
  }

  if (genericOAuthProviders.length > 0) {
    plugins.push(genericOAuth({ config: genericOAuthProviders }))
  }

  if (enableMagicLink) {
    plugins.push(
      magicLink({
        expiresIn: MAGIC_LINK_EXPIRES_IN,
        async sendMagicLink({ email, url }) {
          await sendAuthEmail(
            email,
            getMagicLinkEmailTemplate({
              expiresInSeconds: MAGIC_LINK_EXPIRES_IN,
              url,
            })
          )
        },
      })
    )
  }

  return plugins
}

function buildRateLimitCustomRules() {
  const rules: Record<string, { max: number; window: number }> = {
    // 忘记密码：发送重置链接
    '/request-password-reset': EMAIL_ENDPOINT_RATE_LIMIT,
    // 邮箱验证链接（link 模式）或修改邮箱确认；另受 IP 日限（见 rateLimit.customStorage）
    '/send-verification-email': EMAIL_ENDPOINT_RATE_LIMIT,
  }

  if (useOtpEmailVerification) {
    // OTP 注册验证：verify-email 页手动触发；另受 IP 日限（见 rateLimit.customStorage）
    rules['/email-otp/send-verification-otp'] = EMAIL_ENDPOINT_RATE_LIMIT
  }

  return rules
}

function buildRateLimitConfig(): NonNullable<BetterAuthOptions['rateLimit']> {
  return {
    enabled: true,
    customRules: buildRateLimitCustomRules(),
    // 验证类端点在 customRules 短窗口限流之外，同一 IP 24h 内最多 VERIFICATION_DAILY_IP_MAX 次
    customStorage: createVerificationDailyRateLimitStorage(),
  }
}

/**
 * 构建 Better Auth 服务端实例。
 * 集中定义账户关联、邮箱登录、会话、数据库适配与用户字段映射等配置。
 */
export function defineConfig() {
  const options: BetterAuthOptions = {
    // 账户关联：同邮箱下合并 OAuth 与本地密码账户
    account: {
      accountLinking: {
        // 开启账户关联
        enabled: true,
        // 允许邮箱密码用户与 OAuth 同邮箱账户自动关联（需将 provider 加入 trustedProviders）
        trustedProviders: enabledSSOProviders,
        // 兼容未开启邮箱验证时注册的本地用户（emailVerified 默认为 false）
        requireLocalEmailVerified: false,
      },
    },
    // 应用对外 URL，用于生成回调链接与 Cookie 域
    baseURL: appEnv.APP_URL,
    // sign-out 等带 Cookie 的请求会校验 Origin；需与 CORS 的 ALLOWED_ORIGINS 保持一致
    trustedOrigins: getAllowedOrigins(),
    // 会话签名与加密密钥
    secret: authEnv.AUTH_SECRET,
    // 邮箱 + 密码登录
    emailAndPassword: {
      // 注册/登录成功后自动创建会话
      autoSignIn: true,
      // 禁用邮箱密码注册（AUTH_DISABLE_EMAIL_PASSWORD=1 时仅允许 SSO 登录）
      disableSignUp: authEnv.AUTH_DISABLE_EMAIL_PASSWORD,
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 64,
      // 注册后是否需要验证邮箱
      requireEmailVerification: authEnv.AUTH_EMAIL_VERIFICATION,
      // 重置密码后撤销该用户所有已有会话
      revokeSessionsOnPasswordReset: true,
      // 密码校验
      password: {
        async verify({ hash, password }: { hash: string; password: string }): Promise<boolean> {
          // log('verify: %O', { hash, password })
          if (!hash) return false

          // Better Auth scrypt校验
          return verifyPassword({ hash, password })
        },
      },
      // 发送重置密码邮件
      sendResetPassword: async ({ user, url }) => {
        const template = getResetPasswordEmailTemplate({ url })

        const emailService = new EmailService()
        await emailService.sendMail({
          to: user.email,
          ...template,
        })
      },
    },
    // 邮箱验证（注册确认、修改邮箱等）
    emailVerification: {
      // 验证完成后自动登录
      autoSignInAfterVerification: true,
      // 验证链接过期时间
      expiresIn: VERIFICATION_LINK_EXPIRES_IN,
      sendVerificationEmail: async ({ user, url }, request) => {
        const isChangeEmail = request?.url?.includes('/change-email')

        // OTP 模式下注册验证由 verify-email 页触发 sendVerificationOtp
        if (!isChangeEmail && useOtpEmailVerification) {
          return
        }

        const template = isChangeEmail
          ? getChangeEmailVerificationTemplate({
              expiresInSeconds: VERIFICATION_LINK_EXPIRES_IN,
              url,
              userName: user.name,
            })
          : getVerificationEmailTemplate({
              expiresInSeconds: VERIFICATION_LINK_EXPIRES_IN,
              url,
              userName: user.name,
            })

        const emailService = new EmailService()
        await emailService.sendMail({
          to: user.email,
          ...template,
        })
      },
    },
    // 会话与 Cookie 缓存
    session: {
      // 登录 session 有效期（秒）；未活动满期需重新登录
      expiresIn: 60 * 60 * 24 * 7, // 7 天
      // 滑动续期：距上次延期满 updateAge 后，getSession 会把 expiresAt 再延 expiresIn
      updateAge: 60 * 60 * 24, // 1 天
      cookieCache: {
        enabled: true,
        // Cookie 侧会话缓存时长（秒），减轻 get-session 数据库查询（非登录有效期）
        maxAge: 2 * 60,
      },
      // Redis 等二级存储条目缺失时，仍可从数据库恢复会话
      storeSessionInDatabase: true,
    },
    // Drizzle + PostgreSQL 适配器
    database: drizzleAdapter(serverDB, {
      provider: 'pg',
      // 实验性联表查询需传入完整 schema 关系
      schema,
    }),
    // Redis
    secondaryStorage: createSecondaryStorage(),
    // API 错误时重定向到自定义页面
    onAPIError: {
      errorURL: '/auth-error',
    },
    advanced: {
      database: {
        generateId: ({ model }) => {
          if (model === 'user' || model === 'users') {
            return generateAuthUserId()
          }
          return createNanoId(12)()
        },
      },
    },
    /**
     * 数据库联表查询在 Better-Auth 需要单次查询从多张表获取关联数据时非常有用。
     * /get-session、/get-full-organization 等端点因此特性受益显著，
     * 根据数据库延迟，性能可提升 2 到 3 倍。
     * Ref: https://www.better-auth.com/docs/adapters/drizzle#joins-experimental
     */
    experimental: { joins: true },
    /**
     * 为每个新创建的账户运行用户引导流程（邮箱、魔法链接、OAuth/社交登录等）。
     * 使用 Better Auth 数据库钩子可以捕获绕过 /sign-up/* 路由的社交登录流程。
     * Ref: https://www.better-auth.com/docs/reference/options#databasehooks
     */
    databaseHooks: {
      user: {
        create: {
          // 写入前：确保业务侧 userId（无连字符 UUID）存在
          before: async (user) => {
            log('user create before: %O', user)
            // const userData = {
            //   name: '123456',
            //   email: '123456@qq.com',
            //   emailVerified: false,
            //   image: null,
            //   createdAt: new Date(),
            //   updatedAt: new Date(),
            //   role: 'user',
            //   banned: false,
            //   banReason: null,
            //   banExpires: null,
            //   userId: '',
            //   id: '',
            // }
          },
          // 写入后：懒发放积分由 CreditsModel.ensurePeriod 在首次 PureChat 请求时完成；
          // 此处保留 hook 供后续扩展（如显式 grant）。
          after: async (user) => {
            log('user create after: %O', user)
            try {
              const { CreditsModel } = await import('@pure/database/models/credits')
              const { getShanghaiBillingPeriod } = await import('@/server/purechat/period')
              if (user?.id) {
                await new CreditsModel().ensurePeriod(user.id, getShanghaiBillingPeriod())
              }
            } catch (error) {
              log('credits grant on signup failed: %O', error)
            }
          },
        },
      },
    },
    // 用户表字段映射与扩展字段（对齐现有 users 表结构）
    user: {
      changeEmail: {
        enabled: true,
      },
      additionalFields: {
        // 业务用户 ID，与 auth 主键 id 分离；客户端不可直接提交
        userId: {
          defaultValue: () => generateCompactUuid(),
          input: false,
          required: false,
          type: 'string',
        },
        // 展示用全名；实际读写走 /api/webapi/user/profile，此处声明便于 schema 对齐
        fullName: {
          fieldName: 'full_name',
          input: false,
          required: false,
          type: 'string',
        },
      },
      fields: {
        // Better Auth image → 数据库 avatar
        image: 'avatar',
        // Better Auth name → 数据库 username
        name: 'username',
      },
      modelName: 'users',
    },
    // 内置社交登录（GitHub、Google 等，由 AUTH_SSO_PROVIDERS 控制）
    socialProviders,
    // 敏感邮件端点限流，防止滥发（短窗口 customRules + 验证类 IP 日限 customStorage）
    rateLimit: buildRateLimitConfig(),
    plugins: [admin(), ...buildOptionalAuthPlugins()],
  }

  // log('Better Auth Config: %O', options)
  // log("socialProviders: %O", options.socialProviders)

  return betterAuth(options)
}
