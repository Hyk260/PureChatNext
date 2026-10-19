import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ shell: { openExternal: vi.fn() } }))

import { DesktopAuthService } from '../DesktopAuthService'
import type { DesktopConfigService } from '../DesktopConfigService'

describe('DesktopAuthService logout', () => {
  it('revokes the remote refresh token and clears local credentials', async () => {
    const config = {
      clearPendingAuth: vi.fn().mockResolvedValue(undefined),
      deleteSecrets: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue({ remoteServerUrl: 'https://chat.example' }),
      readSecret: vi.fn().mockResolvedValue('refresh-token'),
      storeSecret: vi.fn().mockResolvedValue(undefined),
    } as unknown as DesktopConfigService
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ message: 'Logout successful' }))
    const service = new DesktopAuthService(config, vi.fn(), fetchImpl)

    await service.logout()

    expect(config.clearPendingAuth).toHaveBeenCalledOnce()
    expect(config.deleteSecrets).toHaveBeenCalledWith(['auth.accessToken', 'auth.refreshToken', 'auth.expiresAt'])
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://chat.example/api/auth/logout',
      expect.objectContaining({
        body: JSON.stringify({ refreshToken: 'refresh-token' }),
        method: 'POST',
      })
    )
  })

  it('does not restore credentials when logout races with an in-flight refresh', async () => {
    const config = {
      clearPendingAuth: vi.fn().mockResolvedValue(undefined),
      deleteSecrets: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue({ remoteServerUrl: 'https://chat.example' }),
      readSecret: vi.fn(async (key: string) => (key === 'auth.refreshToken' ? 'old-refresh' : null)),
      storeSecret: vi.fn().mockResolvedValue(undefined),
    } as unknown as DesktopConfigService
    let finishRefresh: (response: Response) => void = () => undefined
    const fetchImpl = vi.fn((url: string | URL | Request) => {
      if (String(url).endsWith('/api/auth/refresh')) {
        return new Promise<Response>((resolve) => {
          finishRefresh = resolve
        })
      }
      return Promise.resolve(Response.json({ message: 'Logout successful' }))
    })
    const service = new DesktopAuthService(config, vi.fn(), fetchImpl)
    const pendingAuthorization = service.getAuthorizationHeader()

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledWith('https://chat.example/api/auth/refresh', expect.any(Object)))
    await service.logout()
    finishRefresh(
      Response.json({ data: { accessToken: 'late-access', expiresIn: 900, refreshToken: 'late-refresh' } })
    )

    await expect(pendingAuthorization).resolves.toBeNull()
    expect(config.storeSecret).not.toHaveBeenCalled()
  })
})
