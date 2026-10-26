import type { IpcRegistry } from '../ipc/IpcRegistry'
import type { DesktopConfigService } from '../services/DesktopConfigService'
import { DESKTOP_CLOUD_SERVER_URL } from '../runtimeConfig'
import { SITE_DEFAULT_URL } from '@/const/site'

export class ConfigController {
  constructor(
    private readonly config: DesktopConfigService,
    private readonly resetBrowsers?: () => Promise<void>
  ) {}

  register(ipc: IpcRegistry) {
    ipc.register('config.getSnapshot', async () => {
      const { secrets, pendingAuth, ...settings } = await this.config.read()
      return JSON.stringify({
        ...settings,
        secrets: Object.fromEntries(Object.keys(secrets).map((key) => [key, '[已隐藏]'])),
        pendingAuth: pendingAuth ? { ...pendingAuth, state: '[已隐藏]' } : null,
      }, null, 2)
    })
    ipc.register('config.getRemoteServer', async () => ({ url: (await this.config.read()).remoteServerUrl }))
    ipc.register('config.getCloudServer', async () => ({
      url: DESKTOP_CLOUD_SERVER_URL || SITE_DEFAULT_URL,
    }))
    ipc.register('config.setRemoteServer', async (value) => {
      if (typeof value !== 'string' || value.length > 2048) throw new Error('远程服务地址无效')
      const current = await this.config.read()
      if (current.remoteServerUrl !== value) await this.resetBrowsers?.()
      return this.config.setRemoteServer(value)
    })
  }
}
