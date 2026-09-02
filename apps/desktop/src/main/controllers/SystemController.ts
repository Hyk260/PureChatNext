import { promises as fs } from 'node:fs'
import path from 'node:path'

import { app, Notification, shell } from 'electron'

import type { IpcRegistry } from '../ipc/IpcRegistry'
import { assertNotSensitive } from '../security/PathPolicy'
import { isSafeExternalUrl } from '../security/RendererSecurity'
import { SystemToolsService } from '../services/SystemToolsService'

export class SystemController {
  constructor(private readonly systemTools = new SystemToolsService()) {}

  register(ipc: IpcRegistry) {
    ipc.register('app.getInfo', () => ({
      isPackaged: app.isPackaged,
      platform: process.platform,
      version: app.getVersion(),
    }))
    ipc.register('app.getSystemTools', () => this.systemTools.getSystemTools())
    ipc.register('window.openExternal', async (url) => {
      if (!isSafeExternalUrl(url)) throw new Error('不允许打开该外部地址')
      await shell.openExternal(url)
    })
    ipc.register('shell.openPath', async (targetPath) => {
      if (!targetPath || typeof targetPath !== 'string' || !path.isAbsolute(targetPath)) {
        throw new Error('文件夹路径无效')
      }
      const absolute = path.resolve(targetPath)
      const resolved = await fs.realpath(absolute).catch(() => absolute)
      if (!(await fs.stat(resolved)).isDirectory()) throw new Error('路径必须是文件夹')
      assertNotSensitive(resolved)
      // Windows / macOS 均通过 shell.openPath 用系统文件管理器打开目录
      const errorMessage = await shell.openPath(resolved)
      if (errorMessage) throw new Error(errorMessage)
    })
    ipc.register('notification.show', (input) => {
      if (!input.title || input.title.length > 200) throw new Error('通知标题无效')
      if (input.body !== undefined && typeof input.body !== 'string') throw new Error('通知正文无效')
      new Notification({ title: input.title, body: input.body?.slice(0, 1000) }).show()
    })
  }
}
