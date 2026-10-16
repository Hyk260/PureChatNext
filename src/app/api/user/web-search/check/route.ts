import { NextResponse } from 'next/server'
import type { FetchProviderId, SearchProviderId } from '@pure/types'

import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { webSearchCheckSchema } from '@/server/search/settingsSchema'
import { createUserSearchService, loadWebSearchSettings } from '@/server/search/userSettings'

export const POST = withAuth(async (request, { userId }) => {
  const parsed = webSearchCheckSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError('无效的检测请求')
  const startedAt = Date.now()
  const { capability, provider } = parsed.data
  try {
    const settings = await loadWebSearchSettings(userId)
    const service = createUserSearchService(
      {
        ...settings,
        ...(capability === 'search'
          ? { searchProvider: provider as SearchProviderId }
          : { fetchProvider: provider as FetchProviderId }),
      },
      userId,
      capability
    )
    let success: boolean
    if (capability === 'search') {
      const result = await service.query('PureChat')
      success = result.results.length > 0 && !result.errorDetail
    } else {
      const result = await service.crawlPages({ urls: ['https://example.com'] })
      success = result.results.some((item) => 'contentType' in item.data)
    }
    return NextResponse.json(
      {
        success,
        provider,
        durationMs: Date.now() - startedAt,
        message: success ? '连接成功' : '未返回有效内容，请检查密钥、地址、配额及服务可达性',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      {
        success: false,
        provider,
        durationMs: Date.now() - startedAt,
        message: '检测失败，请检查用户密钥、自定义地址和服务器网络访问配置',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }
})
