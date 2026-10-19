export const REFRESH_TOKEN_COOKIE = 'purechat_refresh_token'

export const getRefreshTokenCookie = (request: Request) => {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return undefined

  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=')
    if (separator < 0 || cookie.slice(0, separator).trim() !== REFRESH_TOKEN_COOKIE) continue

    try {
      return decodeURIComponent(cookie.slice(separator + 1).trim())
    } catch {
      return undefined
    }
  }

  return undefined
}

const serializeRefreshTokenCookie = (request: Request, token: string, maxAge: number) => {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${REFRESH_TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`
}

export const setRefreshTokenCookie = (response: Response, request: Request, token: string, expiresAt: Date) => {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
  response.headers.append('Set-Cookie', serializeRefreshTokenCookie(request, token, maxAge))
  return response
}

export const clearRefreshTokenCookie = (response: Response, request: Request) => {
  response.headers.append('Set-Cookie', serializeRefreshTokenCookie(request, '', 0))
  return response
}
