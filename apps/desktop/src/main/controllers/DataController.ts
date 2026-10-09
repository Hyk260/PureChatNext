import type { IpcRegistry } from '../ipc/IpcRegistry'
import type { DesktopDataService } from '../services/DesktopDataService'

export class DataController {
  constructor(private readonly data: DesktopDataService) {}

  register(ipc: IpcRegistry) {
    ipc.register('data.getInfo', () => this.data.getInfo())
    ipc.register('data.openDirectory', (directory) => this.data.openDirectory(directory))
    ipc.register('data.setLogRetention', (days) => this.data.setLogRetention(days))
    ipc.register('data.clearHttpCache', () => this.data.clearHttpCache())
  }
}
