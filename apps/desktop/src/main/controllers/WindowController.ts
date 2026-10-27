import { BrowserWindow } from 'electron'

import type { IpcRegistry } from '../ipc/IpcRegistry'
import type { DesktopConfigService } from '../services/DesktopConfigService'

const getWindow = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]

export class WindowController {
  constructor(
    private readonly config: DesktopConfigService,
    private readonly getTrustedContents: () => Electron.WebContents | null
  ) {}

  private getRendererWindow() {
    const contents = this.getTrustedContents()
    if (!contents || contents.isDestroyed()) return null
    const window = BrowserWindow.fromWebContents(contents)
    return window && !window.isDestroyed() ? window : null
  }

  register(ipc: IpcRegistry) {
    ipc.register('window.openDevTools', () => {
      getWindow()?.webContents.openDevTools({ mode: 'detach' })
    })
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
    ipc.register('window.getZoomFactor', async () => {
      const window = this.getRendererWindow()
      if (window) return window.webContents.getZoomFactor()
      return (await this.config.read()).zoomFactor ?? 1
    })
    ipc.register('window.adjustZoom', async ({ delta, reset = false }) => {
      if (![0, -0.1, 0.1].includes(delta)) throw new Error('缩放步长无效')
      const window = this.getRendererWindow()
      const currentZoom = window?.webContents.getZoomFactor() ?? (await this.config.read()).zoomFactor ?? 1
      const nextZoom = reset ? 1 : Math.min(2, Math.max(0.5, currentZoom + delta))
      const zoomFactor = await this.config.setZoomFactor(nextZoom)
      window?.webContents.setZoomFactor(zoomFactor)
      return zoomFactor
    })
  }
}
