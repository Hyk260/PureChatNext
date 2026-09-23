import { SITE_DEFAULT_URL } from '@/const/site'

const PREVIEW_VERIFY_PATH = '/verify-email?token=preview-token'
const LOCAL_PREVIEW_ORIGIN = 'http://localhost:5174'

const trimTrailingSlash = (value: string) => value.replace(/\/$/, '')

// 浏览器走当前站点；这里不引 appEnv，避免 SPA 打包进服务端 env。
const previewEmailOrigin = () => {
  if (process.env.NODE_ENV === 'test') {
    return LOCAL_PREVIEW_ORIGIN
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  const appUrl = process.env.APP_URL?.trim()
  if (appUrl) {
    return trimTrailingSlash(appUrl)
  }

  if (process.env.NODE_ENV === 'production') {
    return SITE_DEFAULT_URL
  }

  return LOCAL_PREVIEW_ORIGIN
}

export const EMAIL_TEMPLATE_PREVIEW_MOCK = {
  expiresInSeconds: 3600,
  otp: '123456',
  get url() {
    return `${previewEmailOrigin()}${PREVIEW_VERIFY_PATH}`
  },
  userName: 'Preview User',
}

export type EmailTemplateKey = 'verification' | 'change-email' | 'magic-link' | 'reset-password' | 'verification-otp'

export type EmailTemplateParamField = 'url' | 'userName' | 'expiresInSeconds' | 'otp'

export type EmailTemplateParams = {
  expiresInSeconds?: number
  otp?: string
  url?: string
  userName?: string | null
}

export type EmailTemplateCatalogEntry = {
  key: EmailTemplateKey
  label: string
  params: EmailTemplateParamField[]
}

export const EMAIL_TEMPLATE_CATALOG: EmailTemplateCatalogEntry[] = [
  { key: 'verification', label: '注册验证', params: ['url', 'userName', 'expiresInSeconds'] },
  { key: 'change-email', label: '更换邮箱', params: ['url', 'userName', 'expiresInSeconds'] },
  { key: 'magic-link', label: 'Magic Link', params: ['url', 'expiresInSeconds'] },
  { key: 'reset-password', label: '重置密码', params: ['url'] },
  { key: 'verification-otp', label: 'OTP 验证', params: ['userName', 'expiresInSeconds', 'otp'] },
]

export const EMAIL_TEMPLATE_KEYS = EMAIL_TEMPLATE_CATALOG.map((entry) => entry.key)

export type RenderedEmailTemplate = {
  html: string
  subject: string
  text: string
}

const isEmailTemplateKey = (value: string): value is EmailTemplateKey => {
  return EMAIL_TEMPLATE_KEYS.includes(value as EmailTemplateKey)
}

export function parseEmailTemplateKey(value: unknown): EmailTemplateKey | undefined {
  return typeof value === 'string' && isEmailTemplateKey(value) ? value : undefined
}

export function parseEmailTemplateParams(value: unknown): EmailTemplateParams | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }

  const raw = value as Record<string, unknown>
  const params: EmailTemplateParams = {}

  if (typeof raw.url === 'string' && raw.url.trim()) {
    params.url = raw.url.trim()
  }

  if (typeof raw.userName === 'string') {
    params.userName = raw.userName.trim() || null
  } else if (raw.userName === null) {
    params.userName = null
  }

  if (typeof raw.expiresInSeconds === 'number' && Number.isFinite(raw.expiresInSeconds)) {
    params.expiresInSeconds = raw.expiresInSeconds
  }

  if (typeof raw.otp === 'string' && raw.otp.trim()) {
    params.otp = raw.otp.trim()
  }

  return params
}
