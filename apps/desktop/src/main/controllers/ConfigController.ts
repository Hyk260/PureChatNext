import type { IpcRegistry } from '../ipc/IpcRegistry'
import type { DesktopConfigService } from '../services/DesktopConfigService'

export class ConfigController {
  constructor(private readonly config: DesktopConfigService) {}

  register(ipc: IpcRegistry) {
    ipc.register('config.getRemoteServer', async () => ({ url: (await this.config.read()).remoteServerUrl }))
    ipc.register('config.setRemoteServer', (value) => {
      if (typeof value !== 'string' || value.length > 2048) throw new Error('远程服务地址无效')
      return this.config.setRemoteServer(value)
    })
  }
}
