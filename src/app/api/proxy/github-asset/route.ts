import debug from 'debug'

import { githubAssetFetchUrls, parseGithubAssetUrl } from '@/const/community/githubAssetUrl'
import { appEnv } from '@/envs/app'

const log = debug('proxy:github-asset')

const FETCH_TIMEOUT_MS = 8_000
const MAX_ASSET_BYTES = 2 * 1024 * 1024
const USER_AGENT = 'PureChat'

const cacheHeaders = {
  'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
  'X-Content-Type-Options': 'nosniff',
}

const jsonError = (message: string, status = 400) => Response.json({ error: message }, { status })

const isImageContentType = (contentType: string) => contentType.startsWith('image/')

const tooLarge = (contentLength: string | null) => {
  const length = Number(contentLength)
  return Number.isFinite(length) && length > MAX_ASSET_BYTES
}

const isSameOrigin = (left: string, right: string) => {
  try {
    return new URL(left).origin === new URL(right).origin
  } catch {
    return false
  }
}

const isAllowedFinalUrl = (finalUrl: string, candidate: string) =>
  Boolean(parseGithubAssetUrl(finalUrl)) || isSameOrigin(finalUrl, candidate)

class GithubAssetError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'GithubAssetError'
  }
}

const fetchValidImage = async (candidate: string, signal: AbortSignal) => {
  const upstream = await fetch(candidate, {
    cache: 'no-store',
    headers: {
      Accept: 'image/*',
      'User-Agent': USER_AGENT,
    },
    redirect: 'follow',
    signal: AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]),
  })

  if (!isAllowedFinalUrl(upstream.url, candidate)) {
    throw new GithubAssetError('Invalid redirect', 502)
  }
  if (!upstream.ok) throw new GithubAssetError('Failed to fetch GitHub asset', 502)

  const contentType = upstream.headers.get('content-type')?.split(';', 1)[0]?.trim() ?? ''
  if (!isImageContentType(contentType)) throw new GithubAssetError('Not an image', 502)
  if (tooLarge(upstream.headers.get('content-length'))) throw new GithubAssetError('Asset too large', 502)

  const body = Buffer.from(await upstream.arrayBuffer())
  if (body.byteLength > MAX_ASSET_BYTES) throw new GithubAssetError('Asset too large', 502)

  return { body, contentType }
}

const errorFromAggregate = (error: AggregateError) => {
  const assetErrors = error.errors.filter((item): item is GithubAssetError => item instanceof GithubAssetError)
  const first = assetErrors[0]
  if (first && assetErrors.every((item) => item.message === first.message)) {
    return jsonError(first.message, first.status)
  }
  return jsonError('Failed to fetch GitHub asset', 502)
}

/**
 * GET /api/proxy/github-asset
 * 同源代理 GitHub 头像等静态图，避免浏览器直连 github.com。
 * @param request - query `url=` 为 https GitHub 资源地址
 */
export async function GET(request: Request) {
  const rawUrl = new URL(request.url).searchParams.get('url')
  if (!rawUrl) return jsonError('Missing url')

  const target = parseGithubAssetUrl(rawUrl)
  if (!target) return jsonError('Invalid GitHub asset url')

  const candidates = githubAssetFetchUrls(target.href, appEnv.GITHUB_PROXY)
  log('fetch url=%s candidates=%o', target.href, candidates)

  const controller = new AbortController()
  try {
    const image = await Promise.any(candidates.map((candidate) => fetchValidImage(candidate, controller.signal)))
    controller.abort()
    return new Response(image.body, {
      headers: {
        ...cacheHeaders,
        'Content-Type': image.contentType,
      },
    })
  } catch (error) {
    log('fetch failed url=%s error=%O', target.href, error)
    if (error instanceof AggregateError) return errorFromAggregate(error)
    return jsonError('Failed to fetch GitHub asset', 502)
  }
}
