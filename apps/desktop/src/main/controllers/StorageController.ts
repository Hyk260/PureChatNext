import type { IpcRegistry } from '../ipc/IpcRegistry'
import type { DesktopConfigService } from '../services/DesktopConfigService'

const allowedSecretKey = /^[a-zA-Z0-9._-]{1,100}$/
const assertSecretKey = (key: string) => {
  if (!allowedSecretKey.test(key)) throw new Error('非法的安全存储键')
}

export class StorageController {
  constructor(private readonly config: DesktopConfigService) {}

  register(ipc: IpcRegistry) {
    ipc.register('storage.storeSecret', async (key, value) => {
      assertSecretKey(key)
      if (typeof value !== 'string' || value.length > 100_000) throw new Error('安全存储值无效')
      await this.config.storeSecret(key, value)
    })
    ipc.register('storage.deleteSecret', async (key) => {
      assertSecretKey(key)
      await this.config.deleteSecret(key)
    })
  }
}
