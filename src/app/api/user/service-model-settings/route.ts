import { ServiceModelSettingsModel } from '@pure/database/models/serviceModelSettings'
import debug from 'debug'
import { NextResponse } from 'next/server'

import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { serviceModelSettingsPatchSchema } from '@/server/service-model/settingsSchema'
import { resolveSpeechCredentials, SpeechError } from '@/server/speech'
import { speechConfigError } from '@pure/const'

const log = debug('db:service-model-settings')

const response = (settings: Awaited<ReturnType<ServiceModelSettingsModel['get']>>) =>
  NextResponse.json({ settings }, { headers: { 'Cache-Control': 'no-store' } })

/**
 * GET /api/user/service-model-settings
 * 获取当前用户的服务模型设置
 */
export const GET = withAuth(async (_request, { userId }) => {
  try {
    return response(await new ServiceModelSettingsModel().get(userId))
  } catch (error) {
    log('read failed: %o', error)
    return jsonError('读取服务模型设置失败', 503)
  }
})

/**
 * PATCH /api/user/service-model-settings
 * 更新当前用户的服务模型设置，并校验语音配置与凭证
 * @param request - JSON 服务模型设置补丁
 */
export const PATCH = withAuth(async (request, { userId }) => {
  const parsed = serviceModelSettingsPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(parsed.error.issues.map((issue) => issue.message).join('；'))
  try {
    if (parsed.data.qqSpeech) {
      const invalid = speechConfigError(parsed.data.qqSpeech)
      if (invalid) return jsonError(invalid)
      await resolveSpeechCredentials(userId, parsed.data.qqSpeech)
    }
    return response(await new ServiceModelSettingsModel().patch(userId, parsed.data))
  } catch (error) {
    if (error instanceof SpeechError) return jsonError('语音服务商未启用、未配置密钥或模型配置无效')
    log('save failed: %o', error)
    return jsonError('保存服务模型设置失败', 503)
  }
})

/**
 * DELETE /api/user/service-model-settings
 * 清除当前用户保存的服务模型设置
 */
export const DELETE = withAuth(async (_request, { userId }) => {
  try {
    await new ServiceModelSettingsModel().delete(userId)
    return response({})
  } catch (error) {
    log('reset failed: %o', error)
    return jsonError('重置服务模型设置失败', 503)
  }
})
