import { z } from 'zod'

import { CustomProviderModel, isValidProviderId } from '@pure/database/models/customProvider'
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

const patchSchema = z.object({
  apiKey: z.string().max(8192).optional(),
  baseURL: z.string().trim().min(1).max(2048).refine(isHttpUrl, '请输入有效的 http(s) 地址').optional(),
  description: z.string().trim().max(1000).optional(),
  enabled: z.boolean().optional(),
  logo: z.union([z.literal(''), z.string().trim().max(2048).refine(isHttpUrl, '请输入有效的 http(s) 地址')]).optional(),
  name: z.string().trim().min(1).max(128).optional(),
})

const toPublicProvider = (provider: NonNullable<Awaited<ReturnType<CustomProviderModel['find']>>>) => ({
  baseURL: provider.baseURL,
  description: provider.description,
  enabled: provider.enabled,
  id: provider.providerId,
  logo: provider.logo,
  name: provider.name,
})

/** PUT /api/providers/custom/[id] — 更新服务商资料，服务商 ID 保持不变。 */
export const PUT = withAuth<{ id: string }>(async (request, { params, userId }) => {
  const { id } = await params
  if (!isValidProviderId(id)) return jsonError('服务商 ID 无效', 400)

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || '服务商信息无效')
  const { apiKey, ...patch } = parsed.data
  const normalizedPatch = {
    ...patch,
    ...(patch.baseURL ? { baseURL: patch.baseURL.replace(/\/+$/, '') } : {}),
    ...(patch.logo !== undefined ? { logo: patch.logo || null } : {}),
  }
  if (Object.keys(normalizedPatch).length === 0 && apiKey === undefined) return jsonError('没有可更新的字段')

  const model = new CustomProviderModel(userId)
  const provider = await model.update(id, normalizedPatch)
  if (!provider) return jsonError('服务商不存在', 404)

  if (apiKey?.trim()) await new UserProviderSecretModel().upsert(userId, id, { apiKey })

  return Response.json({ item: toPublicProvider(provider), ok: true })
})

/** DELETE /api/providers/custom/[id] — 删除服务商并清除密钥、模型选择及历史元数据引用。 */
export const DELETE = withAuth<{ id: string }>(async (_request, { params, userId }) => {
  const { id } = await params
  if (!isValidProviderId(id)) return jsonError('服务商 ID 无效', 400)

  const model = new CustomProviderModel(userId)
  if (!(await model.find(id))) return jsonError('服务商不存在', 404)
  await model.delete(id)

  return Response.json({ ok: true })
})
