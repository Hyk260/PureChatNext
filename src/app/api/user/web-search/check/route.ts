import { NextResponse } from 'next/server'
import type { FetchProviderId, SearchProviderId } from '@pure/types'

import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { webSearchCheckSchema } from '@/server/search/settingsSchema'
import { createUserSearchService, loadWebSearchSettings } from '@/server/search/userSettings'

const naiveFetchFailureMessage = (errorType?: string, errorMessage = '') => {
  if (/\b(ENOTFOUND|EAI_AGAIN)\b/.test(errorMessage)) {
    return '服务器 DNS 无法解析测试网页域名（ENOTFOUND），请检查服务器 DNS 和网络出口。Fetch 不需要 API 密钥或地址。'
  }

  switch (errorType) {
    case 'NetworkConnectionError':
      return '服务器无法连接测试网页，请检查服务器网络、DNS 和目标网站可达性。Fetch 不需要 API 密钥或地址。'
    case 'Error':
      return '服务器连接测试网页失败，请检查 DNS 和网络出口。Fetch 不需要 API 密钥或地址。'
    case 'TimeoutError':
      return '读取测试网页超时，请检查服务器网络或目标网站响应。Fetch 不需要 API 密钥或地址。'
    case 'PageNotFoundError':
      return '测试网页不存在，请检查目标网站地址。'
    case 'EmptyCrawlResultError':
      return '已访问测试网页，但未提取到足够正文；可尝试内容更丰富的公开网页。'
    default:
      return 'Fetch 未返回有效内容，请检查服务器网络、DNS 和目标网站可达性。'
  }
}

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
    let message: string
    if (capability === 'search') {
      const result = await service.query('PureChat')
      success = result.results.length > 0 && !result.errorDetail
      message = success ? '连接成功' : '未返回有效内容，请检查密钥、地址、配额及服务可达性'
    } else {
      const result = await service.crawlPages({ urls: ['https://example.com'] })
      const crawlResult = result.results[0]
      success = result.results.some((item) => 'contentType' in item.data)
      if (success) {
        message = '连接成功'
      } else if (provider === 'naive') {
        const errorMessage =
          crawlResult && 'errorMessage' in crawlResult.data && typeof crawlResult.data.errorMessage === 'string'
            ? crawlResult.data.errorMessage
            : ''
        const failureType =
          crawlResult && 'errorType' in crawlResult.data && typeof crawlResult.data.errorType === 'string'
            ? crawlResult.data.errorType
            : undefined
        message = !crawlResult
          ? 'Fetch 未返回检测结果，请检查服务器网络和目标网站可达性。'
          : naiveFetchFailureMessage(failureType, errorMessage)
      } else {
        message = '未返回有效内容，请检查密钥、地址、配额及服务可达性'
      }
    }
    return NextResponse.json(
      {
        success,
        provider,
        durationMs: Date.now() - startedAt,
        message,
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
