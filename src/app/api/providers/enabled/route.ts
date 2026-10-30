import { UserProviderSettingsModel } from '@pure/database/models/userProviderSettings'
import { isBuiltinProviderId } from '@pure/const'
import debug from 'debug'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { jsonError, withAuth } from '@/libs/auth/get-session-user'

const log = debug('db:provider-settings')
const isToggleableProviderId = (provider: string) => isBuiltinProviderId(provider) && provider !== 'purechat'
const updateSchema = z.object({
  enabled: z.boolean(),
  provider: z.string().trim().min(1).max(32).refine(isToggleableProviderId),
})

const response = (items: Record<string, boolean>) =>
  NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })

export const GET = withAuth(async (_request, { userId }) => {
  try {
    return response(await new UserProviderSettingsModel().list(userId))
  } catch (error) {
    log('read failed: %o', error)
    return jsonError('读取服务商启用状态失败', 503)
  }
})

export const PUT = withAuth(async (request, { userId }) => {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError('服务商启用状态无效')

  try {
    const { enabled, provider } = parsed.data
    return response(await new UserProviderSettingsModel().setEnabled(userId, provider, enabled))
  } catch (error) {
    log('save failed: %o', error)
    return jsonError('保存服务商启用状态失败', 503)
  }
})
