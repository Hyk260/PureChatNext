const MAX_BASE_URL_LENGTH = 2048

export const normalizeLmStudioBaseURL = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_BASE_URL_LENGTH) throw new Error('LM Studio API 代理地址无效')

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('LM Studio API 代理地址必须包含 http(s)://')
  }

  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('LM Studio API 代理地址必须使用 http 或 https')
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('LM Studio API 代理地址不能包含凭据、查询参数或 hash')
  }

  const pathSegments = url.pathname.split('/').filter(Boolean)
  while (pathSegments.at(-1) === 'v1') pathSegments.pop()
  url.pathname = `/${[...pathSegments, 'v1'].join('/')}`

  return url.toString().replace(/\/$/, '')
}

export const getLmStudioModelsEndpoint = (baseURL: string) => `${normalizeLmStudioBaseURL(baseURL)}/models`

export const getLmStudioNativeModelsEndpoint = (baseURL: string) => {
  const url = new URL(normalizeLmStudioBaseURL(baseURL))
  return `${url.origin}/api/v1/models`
}
