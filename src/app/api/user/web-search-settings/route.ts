import { NextResponse } from 'next/server'
import { WebSearchSettingsModel } from '@pure/database/models/webSearchSettings'

import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { webSearchSettingsPatchSchema } from '@/server/search/settingsSchema'
import { serverWebSearchConfig } from '@/server/search/userSettings'

const response = (settings: Awaited<ReturnType<WebSearchSettingsModel['get']>>) =>
  NextResponse.json({ settings, server: serverWebSearchConfig() }, { headers: { 'Cache-Control': 'no-store' } })

export const GET = withAuth(async (_request, { userId }) => {
  try {
    return response(await new WebSearchSettingsModel().get(userId))
  } catch {
    return jsonError('读取网络搜索设置失败，请检查服务器密钥配置', 503)
  }
})

export const PATCH = withAuth(async (request, { userId }) => {
  const parsed = webSearchSettingsPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(parsed.error.issues.map((issue) => issue.message).join('；'))
  try {
    return response(await new WebSearchSettingsModel().patch(userId, parsed.data))
  } catch {
    return jsonError('保存失败，请检查数据库连接及 KEY_VAULTS_SECRET 配置', 503)
  }
})

export const DELETE = withAuth(async (_request, { userId }) => {
  await new WebSearchSettingsModel().delete(userId)
  return response({})
})
