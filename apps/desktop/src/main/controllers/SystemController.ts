import { app, Notification, shell } from 'electron'

import type { IpcRegistry } from '../ipc/IpcRegistry'
import { isSafeExternalUrl } from '../security/RendererSecurity'

export class SystemController {
  register(ipc: IpcRegistry) {
    ipc.register('app.getInfo', () => ({
      isPackaged: app.isPackaged,
      platform: process.platform,
      version: app.getVersion(),
    }))
    ipc.register('window.openExternal', async (url) => {
      if (!isSafeExternalUrl(url)) throw new Error('不允许打开该外部地址')
      await shell.openExternal(url)
    })
    ipc.register('notification.show', (input) => {
      if (!input.title || input.title.length > 200) throw new Error('通知标题无效')
      if (input.body !== undefined && typeof input.body !== 'string') throw new Error('通知正文无效')
      new Notification({ title: input.title, body: input.body?.slice(0, 1000) }).show()
    })
  }
}
