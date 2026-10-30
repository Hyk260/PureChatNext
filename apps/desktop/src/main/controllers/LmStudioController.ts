import type { IpcRegistry } from '../ipc/IpcRegistry'
import type { DesktopConfigService } from '../services/DesktopConfigService'

export class LmStudioController {
  constructor(private readonly config: DesktopConfigService) {}

  register(ipc: IpcRegistry) {
    ipc.register('lmstudio.settings.getRuntimeConfig', (input) =>
      this.config.getLmStudioRuntimeConfig(input.accountId, input.providerId)
    )
    ipc.register('lmstudio.settings.clearLegacy', (input) =>
      this.config.clearLmStudioLegacySettings(input.accountId, input.providerId)
    )
  }
}
