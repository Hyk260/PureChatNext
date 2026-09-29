import { BrowserWindow } from 'electron'

import type { IpcRegistry } from '../ipc/IpcRegistry'

const getWindow = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]

export class WindowController {
  register(ipc: IpcRegistry) {
    ipc.register('window.getState', () => ({ isMaximized: getWindow()?.isMaximized() ?? false }))
    ipc.register('window.minimize', () => {
      getWindow()?.minimize()
    })
    ipc.register('window.toggleMaximize', () => {
      const window = getWindow()
      if (!window) return { isMaximized: false }
      if (window.isMaximized()) window.unmaximize()
      else window.maximize()
      return { isMaximized: window.isMaximized() }
    })
    ipc.register('window.close', () => {
      getWindow()?.close()
    })
  }
}
