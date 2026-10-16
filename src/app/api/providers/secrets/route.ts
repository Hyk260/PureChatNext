import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

import {
  isUserProviderSecretId,
  MissingProviderApiKeyError,
  UserProviderSecretModel,
} from '@pure/database/models/userProviderSecret'
import { CustomProviderModel } from '@pure/database/models/customProvider'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const putSchema = z.object({
  apiKey: z.string().max(8192).optional(),
  baseURL: z.string().max(2048).optional(),
  provider: z.string().trim().min(1).max(32).refine(isUserProviderSecretId),
})

const deleteSchema = z.object({
  provider: z.string().trim().min(1).max(32).refine(isUserProviderSecretId),
})

const isBuiltinSecretProvider = (provider: string) => provider === 'openai' || provider === 'deepseek'

const isOwnedProvider = async (userId: string, provider: string) => {
  if (isBuiltinSecretProvider(provider)) return true
  return Boolean(await new CustomProviderModel(userId).find(provider))
}

const isMissingVaultSecretError = (error: unknown) =>
  error instanceof Error && error.message.includes('KEY_VAULTS_SECRET')

/**
 * GET /api/providers/secrets
 * 当前用户已保存的服务商密钥（含明文 API Key，仅返回给本人；落库仍为 AES-GCM）
 */
export const GET = withAuth(async (_request, { userId }) => {
  const items = await new UserProviderSecretModel().listPublic(userId)
  return NextResponse.json({ items })
})

/**
 * PUT /api/providers/secrets
 * 加密保存用户服务商 API Key 与代理地址
 * @param request - JSON `{ provider, apiKey?, baseURL? }`；空 apiKey 表示保留原密钥
 */
export const PUT = withAuth(async (request: NextRequest, { userId }) => {
  const parsed = putSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError('Invalid secret request')

  const { apiKey, baseURL, provider } = parsed.data
  if (apiKey === undefined && baseURL === undefined) return jsonError('apiKey or baseURL is required')
  if (!(await isOwnedProvider(userId, provider))) return jsonError('Unsupported provider', 400)

  try {
    const item = await new UserProviderSecretModel().upsert(userId, provider, { apiKey, baseURL })
    return NextResponse.json({ item, ok: true })
  } catch (error) {
    if (error instanceof MissingProviderApiKeyError) return jsonError(error.message)
    if (isMissingVaultSecretError(error)) {
      return jsonError('服务器未配置 KEY_VAULTS_SECRET，无法加密保存密钥', 503)
    }
    throw error
  }
})

/**
 * DELETE /api/providers/secrets
 * 删除当前用户指定服务商的密钥
 * @param request - JSON `{ provider }`
 */
export const DELETE = withAuth(async (request: NextRequest, { userId }) => {
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError('Invalid secret request')
  if (!(await isOwnedProvider(userId, parsed.data.provider))) return jsonError('Unsupported provider')

  await new UserProviderSecretModel().delete(userId, parsed.data.provider)
  return NextResponse.json({ ok: true })
})
