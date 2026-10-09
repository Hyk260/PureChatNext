import type { DesktopAuthService } from '../services/DesktopAuthService'
import type { IpcRegistry } from '../ipc/IpcRegistry'

export class AuthController {
  constructor(private readonly auth: DesktopAuthService) {}

  register(ipc: IpcRegistry) {
    ipc.register('auth.start', (input) => {
      if (!input || typeof input.serverUrl !== 'string' || input.serverUrl.length > 2048) {
        throw new Error('授权服务地址无效')
      }
      return this.auth.start(input.serverUrl)
    })
    ipc.register('auth.getStatus', () => this.auth.getStatus())
    ipc.register('auth.cancel', () => this.auth.cancel())
    ipc.register('auth.logout', () => this.auth.logout())
  }
}
