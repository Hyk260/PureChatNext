import { createHash, randomBytes } from 'node:crypto'

import { shell } from 'electron'

import { DESKTOP_AUTH_CLIENT_ID, DESKTOP_AUTH_REDIRECT_URI } from '@/const/desktopAuth'
import type { DesktopAuthStatus } from '@/types/desktop'

import { isSafeExternalUrl } from '../rendererSecurity'
import { parseDesktopAuthCallback } from '../protocolLink'
import type { DesktopConfigService } from './DesktopConfigService'
import { normalizeRemoteServerUrl } from './DesktopConfigService'

const AUTH_TIMEOUT_MS = 5 * 60_000
const REFRESH_SKEW_MS = 30_000

type TokenResponse = {
  access_token?: string
  expires_in?: number
  expiresIn?: number
  refresh_token?: string
}

const toPkceChallenge = (verifier: string) => createHash('sha256').update(verifier).digest('base64url')

const parseTokenExpiry = (value: string | undefined) => {
  const match = value?.trim().match(/^(\d+)([smhd])$/i)
  if (!match) return 900
  const amount = Number(match[1])
  const unit = { d: 86_400, h: 3_600, m: 60, s: 1 }[match[2].toLowerCase() as 'd' | 'h' | 'm' | 's']
  return amount * unit
}

const getResponseError = async (response: Response, fallback: string) => {
  const body = (await response.json().catch(() => null)) as { error?: string; message?: string } | null
  return body?.error || body?.message || fallback
}

export class DesktopAuthService {
  private refreshPromise: Promise<string | null> | null = null

  constructor(
    private readonly config: DesktopConfigService,
    private readonly onStatusChange: (status: DesktopAuthStatus) => void,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async start(serverUrl: string) {
    const normalizedUrl = normalizeRemoteServerUrl(serverUrl)
    if (!isSafeExternalUrl(normalizedUrl)) {
      throw new Error('授权服务必须使用 HTTPS，或使用 localhost/127.0.0.1')
    }

    await this.config.setRemoteServer(normalizedUrl)
    await this.clearTokens()

    const verifier = randomBytes(48).toString('base64url')
    const state = randomBytes(32).toString('base64url')
    const expiresAt = Date.now() + AUTH_TIMEOUT_MS
    await this.config.setPendingAuth({
      expiresAt,
      redirectUri: DESKTOP_AUTH_REDIRECT_URI,
      serverUrl: normalizedUrl,
      state,
    })
    await this.config.storeSecret('auth.pendingVerifier', verifier)

    const authUrl = new URL('/desktop-authorize', `${normalizedUrl}/`)
    authUrl.search = new URLSearchParams({
      client_id: DESKTOP_AUTH_CLIENT_ID,
      code_challenge: toPkceChallenge(verifier),
      code_challenge_method: 'S256',
      prompt: 'consent',
      redirect_uri: DESKTOP_AUTH_REDIRECT_URI,
      response_type: 'code',
      scope: 'profile email offline_access',
      state,
    }).toString()

    try {
      await shell.openExternal(authUrl.toString())
    } catch (error) {
      await this.config.clearPendingAuth()
      throw error
    }

    return this.setStatus({ expiresAt, status: 'waiting' })
  }
  async getStatus(): Promise<DesktopAuthStatus> {
    const config = await this.config.read()
    const accessToken = await this.config.readSecret('auth.accessToken')
    const refreshToken = await this.config.readSecret('auth.refreshToken')
    const expiresAt = Number(await this.config.readSecret('auth.expiresAt'))

    if (accessToken && Number.isFinite(expiresAt) && expiresAt > Date.now() + REFRESH_SKEW_MS) {
      return this.setStatus({ status: 'signedIn' })
    }
    if (refreshToken && config.remoteServerUrl) {
      const refreshed = await this.refreshAccessToken().catch(() => null)
      if (refreshed) return this.setStatus({ status: 'signedIn' })
    }
    if (config.pendingAuth) return this.setStatus({ expiresAt: config.pendingAuth.expiresAt, status: 'waiting' })
    return this.setStatus({ status: 'signedOut' })
  }

  async cancel() {
    await this.config.clearPendingAuth()
    return this.setStatus({ status: 'signedOut' })
  }

  async logout() {
    await this.config.clearPendingAuth()
    await this.clearTokens()
    return this.setStatus({ status: 'signedOut' })
  }

  async handleProtocolLink(value: string) {
    const callback = parseDesktopAuthCallback(value)
    if (!callback) return false

    const pending = (await this.config.read()).pendingAuth
    const verifier = await this.config.readSecret('auth.pendingVerifier')
    if (!pending || !verifier || pending.expiresAt <= Date.now()) {
      await this.config.clearPendingAuth()
      this.setStatus({ message: '授权已过期，请重新开始登录', status: 'error' })
      return true
    }
    if (callback.state !== pending.state) {
      this.setStatus({ message: '授权状态校验失败，请重新开始登录', status: 'error' })
      return true
    }
    if (callback.error) {
      await this.config.clearPendingAuth()
      this.setStatus({ message: callback.errorDescription || '授权未完成', status: 'error' })
      return true
    }
    if (!callback.code) {
      this.setStatus({ message: '授权结果无效，请重新开始登录', status: 'error' })
      return true
    }

    const body = new URLSearchParams({
      client_id: DESKTOP_AUTH_CLIENT_ID,
      code: callback.code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: pending.redirectUri,
    })
    const response = await this.fetchImpl(new URL('/api/auth/desktop/token', `${pending.serverUrl}/`).toString(), {
      body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    }).catch(() => null)

    if (!response?.ok) {
      await this.config.clearPendingAuth()
      this.setStatus({
        message: response ? await getResponseError(response, '授权交换失败') : '无法连接授权服务',
        status: 'error',
      })
      return true
    }

    const tokenResponse = (await response.json()) as TokenResponse
    if (!tokenResponse.access_token || !tokenResponse.refresh_token) {
      await this.config.clearPendingAuth()
      this.setStatus({ message: '授权服务返回了无效令牌', status: 'error' })
      return true
    }

    const expiresIn = tokenResponse.expires_in ?? parseTokenExpiry(process.env.JWT_ACCESS_EXPIRATION)
    await this.config.storeSecret('auth.accessToken', tokenResponse.access_token)
    await this.config.storeSecret('auth.refreshToken', tokenResponse.refresh_token)
    await this.config.storeSecret('auth.expiresAt', String(Date.now() + expiresIn * 1000))
    await this.config.clearPendingAuth()
    this.setStatus({ status: 'signedIn' })
    return true
  }

  async getAuthorizationHeader() {
    const accessToken = await this.getAccessToken()
    return accessToken ? `Bearer ${accessToken}` : null
  }

  private async getAccessToken() {
    const accessToken = await this.config.readSecret('auth.accessToken')
    const expiresAt = Number(await this.config.readSecret('auth.expiresAt'))
    if (accessToken && Number.isFinite(expiresAt) && expiresAt > Date.now() + REFRESH_SKEW_MS) return accessToken
    return this.refreshAccessToken()
  }

  private async refreshAccessToken() {
    if (this.refreshPromise) return this.refreshPromise
    this.refreshPromise = this.performRefresh().finally(() => {
      this.refreshPromise = null
    })
    return this.refreshPromise
  }

  private async performRefresh() {
    const config = await this.config.read()
    const refreshToken = await this.config.readSecret('auth.refreshToken')
    if (!config.remoteServerUrl || !refreshToken) return null

    const response = await this.fetchImpl(new URL('/api/auth/refresh', `${config.remoteServerUrl}/`).toString(), {
      body: JSON.stringify({ refreshToken }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }).catch(() => null)
    if (!response?.ok) {
      await this.clearTokens()
      this.setStatus({ status: 'signedOut' })
      return null
    }

    const body = (await response.json()) as {
      data?: TokenResponse & { accessToken?: string; refreshToken?: string }
    }
    const accessToken = body.data?.access_token ?? body.data?.accessToken
    const nextRefreshToken = body.data?.refresh_token ?? body.data?.refreshToken
    if (!accessToken || !nextRefreshToken) {
      await this.clearTokens()
      this.setStatus({ status: 'signedOut' })
      return null
    }
    await this.config.storeSecret('auth.accessToken', accessToken)
    await this.config.storeSecret('auth.refreshToken', nextRefreshToken)
    const expiresIn = body.data?.expires_in ?? body.data?.expiresIn ?? parseTokenExpiry(process.env.JWT_ACCESS_EXPIRATION)
    await this.config.storeSecret('auth.expiresAt', String(Date.now() + expiresIn * 1000))
    return accessToken
  }

  private async clearTokens() {
    await this.config.deleteSecrets(['auth.accessToken', 'auth.refreshToken', 'auth.expiresAt'])
  }

  private setStatus(status: DesktopAuthStatus) {
    this.onStatusChange(status)
    return status
  }
}
