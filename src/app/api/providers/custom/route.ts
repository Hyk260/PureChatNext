import { z } from 'zod'

import { CustomProviderModel, BUILTIN_PROVIDER_IDS, isValidProviderId } from '@pure/database/models/customProvider'
import { UserProviderSecretModel } from '@pure/database/models/userProviderSecret'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.hash && !url.search
  } catch {
    return false
  }
}

const customProviderSchema = z.object({
  apiKey: z.string().max(8192).optional(),
  baseURL: z.string().trim().min(1).max(2048).refine(isHttpUrl, '请输入有效的 http(s) 地址'),
  description: z.string().trim().max(1000).default(''),
  enabled: z.boolean().optional(),
  id: z.string().trim().refine(isValidProviderId, 'ID 只能使用小写字母、数字、下划线和连字符，最长 32 位'),
  logo: z.union([z.literal(''), z.string().trim().max(2048).refine(isHttpUrl, '请输入有效的 http(s) 地址')]).optional(),
  name: z.string().trim().min(1).max(128),
})

const toPublicProvider = (provider: Awaited<ReturnType<CustomProviderModel['create']>>) => ({
  baseURL: provider.baseURL,
  description: provider.description,
  enabled: provider.enabled,
  id: provider.providerId,
  logo: provider.logo,
  name: provider.name,
})

/** GET /api/providers/custom — 列出当前用户的自定义服务商。 */
export const GET = withAuth(async (_request, { userId }) => {
  const providers = await new CustomProviderModel(userId).list()
  return Response.json({ items: providers.map(toPublicProvider) })
})

/** POST /api/providers/custom — 创建用户级 OpenAI 兼容服务商。 */
export const POST = withAuth(async (request, { userId }) => {
  const parsed = customProviderSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || '服务商信息无效')

  const { apiKey, ...values } = parsed.data
  const providerId = values.id.toLowerCase()
  if (BUILTIN_PROVIDER_IDS.has(providerId)) return jsonError('该服务商 ID 已被内置服务商占用', 409)

  const model = new CustomProviderModel(userId)
  if (await model.find(providerId)) return jsonError('该服务商 ID 已存在', 409)

  try {
    const created = await model.create({
      baseURL: values.baseURL.replace(/\/+$/, ''),
      description: values.description,
      enabled: values.enabled ?? true,
      logo: values.logo || null,
      name: values.name,
      providerId,
    })

    if (apiKey?.trim()) {
      try {
        await new UserProviderSecretModel().upsert(userId, providerId, { apiKey })
      } catch (error) {
        await model.delete(providerId)
        throw error
      }
    }

    return Response.json({ item: toPublicProvider(created), ok: true }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && /unique|duplicate/i.test(error.message)) {
      return jsonError('该服务商 ID 已存在', 409)
    }
    throw error
  }
})
