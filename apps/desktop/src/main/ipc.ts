import { promises as fs } from 'node:fs'
import path from 'node:path'

import {
  app,
  dialog,
  ipcMain,
  Notification,
  safeStorage,
  shell,
} from 'electron'

import { createConfigStore, normalizeRemoteServerUrl } from './desktopConfig'
import { assertTrustedIpcSender, isSafeExternalUrl } from './rendererSecurity'

const allowedSecretKey = /^[a-zA-Z0-9._-]{1,100}$/

const assertSecretKey = (key: string) => {
  if (!allowedSecretKey.test(key)) throw new Error('非法的安全存储键')
}

const encryptSecret = (value: string) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统没有可用的安全存储，未保存敏感信息')
  }
  return `safe:${safeStorage.encryptString(value).toString('base64')}`
}

export const registerIpcHandlers = async (options: {
  getTrustedContents: () => Electron.WebContents | null
  rendererUrl: string
}) => {
  const store = await createConfigStore(app.getPath('userData'))

  const secureHandle = (channel: string, handler: Parameters<typeof ipcMain.handle>[1]) => {
    ipcMain.handle(channel, (event, ...args) => {
      assertTrustedIpcSender(event, options.getTrustedContents(), options.rendererUrl)
      return handler(event, ...args)
    })
  }

  secureHandle('app:get-info', () => ({
    isPackaged: app.isPackaged,
    platform: process.platform,
    version: app.getVersion(),
  }))

  secureHandle('config:get-remote-server', async () => ({
    url: (await store.read()).remoteServerUrl,
  }))

  secureHandle('config:set-remote-server', async (_event, value: unknown) => {
    if (typeof value !== 'string') throw new Error('远程服务地址必须是字符串')
    const config = await store.read()
    const url = normalizeRemoteServerUrl(value)
    await store.write({ ...config, remoteServerUrl: url })
    return { url }
  })

  secureHandle('storage:store-secret', async (_event, key: unknown, value: unknown) => {
    if (typeof key !== 'string' || typeof value !== 'string') throw new Error('安全存储参数无效')
    assertSecretKey(key)
    const config = await store.read()
    config.secrets[key] = encryptSecret(value)
    await store.write(config)
  })

  secureHandle('storage:delete-secret', async (_event, key: unknown) => {
    if (typeof key !== 'string') throw new Error('安全存储键无效')
    assertSecretKey(key)
    const config = await store.read()
    delete config.secrets[key]
    await store.write(config)
  })

  secureHandle('dialog:choose-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths[0]) return null
    const selectedPath = path.resolve(result.filePaths[0])
    const stat = await fs.stat(selectedPath)
    if (!stat.isFile()) return null
    return { name: path.basename(selectedPath), path: selectedPath }
  })

  secureHandle('window:open-external', async (_event, value: unknown) => {
    if (typeof value !== 'string' || !isSafeExternalUrl(value)) throw new Error('不允许打开该外部地址')
    await shell.openExternal(value)
  })

  secureHandle('notification:show', (_event, input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('通知参数无效')
    const { title, body } = input as { title?: unknown; body?: unknown }
    if (typeof title !== 'string' || title.length === 0 || title.length > 200) throw new Error('通知标题无效')
    new Notification({ title, body: typeof body === 'string' ? body.slice(0, 1000) : undefined }).show()
  })

  return {
    getRemoteServerUrl: async () => (await store.read()).remoteServerUrl,
  }
}
