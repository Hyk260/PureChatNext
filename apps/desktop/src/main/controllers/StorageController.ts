import { safeStorage } from 'electron'

import type { IpcRegistry } from '../ipc/IpcRegistry'
import type { DesktopConfigService } from '../services/DesktopConfigService'

const allowedSecretKey = /^[a-zA-Z0-9._-]{1,100}$/
const assertSecretKey = (key: string) => {
  if (!allowedSecretKey.test(key)) throw new Error('非法的安全存储键')
}

export class StorageController {
  constructor(private readonly config: DesktopConfigService) {}

  private encrypt(value: string) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('当前系统没有可用的安全存储，未保存敏感信息')
    return `safe:${safeStorage.encryptString(value).toString('base64')}`
  }

  register(ipc: IpcRegistry) {
    ipc.register('storage.storeSecret', async (key, value) => {
      assertSecretKey(key)
      if (typeof value !== 'string' || value.length > 100_000) throw new Error('安全存储值无效')
      const config = await this.config.read()
      config.secrets[key] = this.encrypt(value)
      await this.config.write(config)
    })
    ipc.register('storage.deleteSecret', async (key) => {
      assertSecretKey(key)
      const config = await this.config.read()
      delete config.secrets[key]
      await this.config.write(config)
    })
  }
}
