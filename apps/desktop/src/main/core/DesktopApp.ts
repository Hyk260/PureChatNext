import path from 'node:path'

import { app } from 'electron'

import { registerDesktopIpc } from '../ipc/register'
import { protocolLinksFromCommandLine, resolveProtocolLink } from '../protocolLink'
import { APP_RENDERER_URL, isTrustedRendererUrl } from '../rendererSecurity'
import { installApplicationMenu } from '../ui/ApplicationMenu'
import { DesktopConfigService } from '../services/DesktopConfigService'
import { UpdateService } from '../services/UpdateService'
import { ProtocolManager } from './ProtocolManager'
import { TrayManager } from './TrayManager'
import { WindowManager, resolvePreloadPath } from './WindowManager'

const protocolScheme = 'purechat'

export class DesktopApp {
  private readonly rendererUrl: string
  private readonly windowManager: WindowManager
  private readonly trayManager: TrayManager
  private readonly protocolManager: ProtocolManager
  private readonly updateService = new UpdateService()
  private readonly pendingProtocolLinks: string[]
  private readonly config: DesktopConfigService
  private disposeIpc: (() => void) | null = null
  private isQuitting = false

  constructor(private readonly mainDir: string) {
    ProtocolManager.registerScheme()
    this.rendererUrl = app.isPackaged
      ? APP_RENDERER_URL
      : process.env.ELECTRON_RENDERER_URL || `http://127.0.0.1:${process.env.PURECHAT_DESKTOP_VITE_PORT || 5176}`
    this.pendingProtocolLinks = protocolLinksFromCommandLine(process.argv)
      .map(resolveProtocolLink)
      .filter((url): url is string => Boolean(url))
    this.config = new DesktopConfigService(app.getPath('userData'))

    this.windowManager = new WindowManager(
      this.rendererUrl,
      resolvePreloadPath(mainDir),
      this.getDesktopResourcePath(app.isPackaged ? 'purechat-appicon.png' : 'icon.png'),
      () => !this.isQuitting && this.trayManager.exists,
      this.config
    )
    this.trayManager = new TrayManager(
      this.getDesktopResourcePath('tray.png'),
      () => this.focusWindow(),
      () => app.quit()
    )
    this.protocolManager = new ProtocolManager(path.resolve(mainDir, '../renderer'), async () => null)

    app.on('open-url', (event, url) => {
      event.preventDefault()
      this.openProtocolLinks([url])
    })
    app.on('second-instance', (_event, commandLine) => {
      this.openProtocolLinks(protocolLinksFromCommandLine(commandLine))
      this.focusWindow()
    })
    app.on('activate', () => {
      if (!this.windowManager.isOpen) void this.createWindow()
      else this.focusWindow()
    })
    app.on('before-quit', () => {
      this.isQuitting = true
      this.disposeIpc?.()
      this.disposeIpc = null
      this.updateService.dispose()
      this.windowManager.close()
      this.trayManager.destroy()
    })
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin' && !this.trayManager.exists) app.quit()
    })
  }

  async bootstrap() {
    if (!app.requestSingleInstanceLock()) {
      app.quit()
      return
    }

    await app.whenReady()
    this.updateService.start()
    installApplicationMenu()
    this.registerProtocolClient()
    if (!isTrustedRendererUrl(this.rendererUrl, this.rendererUrl)) {
      throw new Error('非法的桌面渲染页地址')
    }

    const ipc = await registerDesktopIpc({
      config: this.config,
      getTrustedContents: () => this.windowManager.trustedContents,
      rendererUrl: this.rendererUrl,
    })
    this.disposeIpc = ipc.dispose
    this.protocolManager.setRemoteServerUrlGetter(ipc.getRemoteServerUrl)
    this.protocolManager.initialize()
    await this.createWindow()
    this.trayManager.create()
  }

  private async createWindow() {
    const window = await this.windowManager.create()
    const initialLink = this.pendingProtocolLinks.pop()
    if (initialLink) await window.loadURL(initialLink)
    return window
  }

  private focusWindow() {
    this.windowManager.focus()
  }

  private openProtocolLinks(links: readonly string[]) {
    const rendererLinks = links.map(resolveProtocolLink).filter((url): url is string => Boolean(url))
    if (rendererLinks.length === 0) return
    if (!this.windowManager.isOpen) {
      this.pendingProtocolLinks.push(...rendererLinks)
      return
    }
    this.focusWindow()
    const url = rendererLinks.at(-1)
    if (url) void this.windowManager.navigate(url)
  }

  private registerProtocolClient() {
    if (process.defaultApp && process.argv[1]) {
      app.setAsDefaultProtocolClient(protocolScheme, process.execPath, [path.resolve(process.argv[1])])
    } else {
      app.setAsDefaultProtocolClient(protocolScheme)
    }
  }

  private getDesktopResourcePath(name: string) {
    return app.isPackaged ? path.join(process.resourcesPath, name) : path.resolve(this.mainDir, '../../build', name)
  }
}
