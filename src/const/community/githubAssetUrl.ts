const GITHUB_ASSET_HOSTS = new Set([
  'avatars.githubusercontent.com',
  'camo.githubusercontent.com',
  'github.com',
  'raw.githubusercontent.com',
  'user-images.githubusercontent.com',
  'www.github.com',
])

const GITHUB_COM_AVATAR_PATH = /^\/([\w.-]+)\.(?:png|jpe?g|gif|webp|svg)\/?$/i
const RAW_IMAGE_PATH = /\.(?:png|jpe?g|gif|webp|svg|ico|bmp)$/i

export const GITHUB_ASSET_PROXY_PATH = '/api/proxy/github-asset'
export const GITHUB_IMAGE_CDN = 'https://wsrv.nl/'

const MAX_GITHUB_ASSET_URL_LENGTH = 2048

const isGithubComHost = (hostname: string) => hostname === 'github.com' || hostname === 'www.github.com'

const isRawGithubHost = (hostname: string) =>
  hostname === 'raw.githubusercontent.com' || hostname === 'user-images.githubusercontent.com'

const isAllowedGithubAssetPath = (url: URL) => {
  if (isGithubComHost(url.hostname)) return GITHUB_COM_AVATAR_PATH.test(url.pathname)
  if (isRawGithubHost(url.hostname)) return RAW_IMAGE_PATH.test(url.pathname)
  return url.pathname.length > 1
}

/** Parse a browser-facing GitHub image URL that this app is willing to proxy. */
export const parseGithubAssetUrl = (value: string): URL | null => {
  if (value.length > MAX_GITHUB_ASSET_URL_LENGTH) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    if (!GITHUB_ASSET_HOSTS.has(url.hostname)) return null
    if (!isAllowedGithubAssetPath(url)) return null
    return url
  } catch {
    return null
  }
}

/** `github.com/user.png` is often blocked in CN; avatars.githubusercontent.com is the real CDN. */
export const githubAvatarCdnUrl = (url: URL): string | null => {
  if (!isGithubComHost(url.hostname)) return null
  const match = url.pathname.match(GITHUB_COM_AVATAR_PATH)
  if (!match) return null
  const cdn = new URL(`https://avatars.githubusercontent.com/${match[1]}`)
  const size = url.searchParams.get('size')
  if (size) cdn.searchParams.set('s', size)
  return cdn.href
}

export const githubWsrvUrl = (assetUrl: string) => {
  const withoutProtocol = assetUrl.replace(/^https:\/\//, '')
  return `${GITHUB_IMAGE_CDN}?url=${encodeURIComponent(withoutProtocol)}`
}

/** Rewrite GitHub-hosted images through the same-origin proxy; leave other values untouched. */
export const githubAssetUrl = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined
  if (!parseGithubAssetUrl(value)) return value
  return `${GITHUB_ASSET_PROXY_PATH}?url=${encodeURIComponent(value)}`
}

export const githubAssetAvatar = (icon: string | null | undefined, fallback: string) =>
  githubAssetUrl(icon) || fallback

/** Prefix a GitHub asset URL with a download mirror (`https://ghfast.top/` + original URL). */
export const joinGithubProxy = (proxy: string, assetUrl: string) => {
  const base = proxy.endsWith('/') ? proxy : `${proxy}/`
  return `${base}${assetUrl}`
}

/** Server-side fetch candidates: avatar CDN, image CDN, optional GITHUB_PROXY, then origin. */
export const githubAssetFetchUrls = (assetUrl: string, proxy?: string) => {
  const parsed = parseGithubAssetUrl(assetUrl)
  const urls: string[] = []
  if (proxy) urls.push(joinGithubProxy(proxy, assetUrl))
  const avatarCdn = parsed ? githubAvatarCdnUrl(parsed) : null
  if (avatarCdn) urls.push(avatarCdn)
  urls.push(githubWsrvUrl(assetUrl))
  urls.push(assetUrl)
  return [...new Set(urls)]
}
