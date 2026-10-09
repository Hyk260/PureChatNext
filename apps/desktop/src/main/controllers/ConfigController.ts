import type { IpcRegistry } from '../ipc/IpcRegistry'
import type { DesktopConfigService } from '../services/DesktopConfigService'
import { DESKTOP_CLOUD_SERVER_URL } from '../runtimeConfig'
import { SITE_DEFAULT_URL } from '@/const/site'

export class ConfigController {
  constructor(private readonly config: DesktopConfigService) {}

  register(ipc: IpcRegistry) {
    ipc.register('config.getRemoteServer', async () => ({ url: (await this.config.read()).remoteServerUrl }))
    ipc.register('config.getCloudServer', async () => ({
      url: DESKTOP_CLOUD_SERVER_URL || SITE_DEFAULT_URL,
    }))
    ipc.register('config.setRemoteServer', (value) => {
      if (typeof value !== 'string' || value.length > 2048) throw new Error('远程服务地址无效')
      return this.config.setRemoteServer(value)
    })
  }
}
