import type { IpcRegistry } from '../ipc/IpcRegistry'
import type { UpdateService } from '../services/UpdateService'

export class UpdateController {
  constructor(private readonly service: UpdateService) {}

  register(ipc: IpcRegistry) {
    ipc.register('updater.getState', () => this.service.getState())
    ipc.register('updater.check', () => this.service.check())
    ipc.register('updater.clearCache', () => this.service.clearCache())
    ipc.register('updater.setPreferences', (preferences) => this.service.setPreferences(preferences))
    ipc.register('updater.install', () => this.service.install())
  }
}
