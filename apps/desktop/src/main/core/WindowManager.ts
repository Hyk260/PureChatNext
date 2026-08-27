import path from 'node:path'

import { BrowserWindow, shell } from 'electron'

import { isSafeExternalUrl, isTrustedRendererUrl } from '../security/RendererSecurity'
import type { DesktopConfigService, DesktopWindowState } from '../services/DesktopConfigService'

export class WindowManager {
  private window: BrowserWindow | null = null

  constructor(
    private readonly rendererUrl: string,
    private readonly preloadPath: string,
    private readonly iconPath: string,
    private readonly shouldHideOnClose: () => boolean = () => false,
    private readonly config?: DesktopConfigService
  ) {}

  get trustedContents() {
    return this.window?.webContents ?? null
  }

  get isOpen() {
    return this.window !== null
  }

  async create() {
    if (this.window) return this.window
    const savedState = await this.config?.read().then((value) => value.windowState)
    const window = new BrowserWindow({
      height: savedState?.height ?? 800,
      icon: this.iconPath,
      minHeight: 520,
      minWidth: 860,
      show: false,
      title: 'PureChat',
      width: savedState?.width ?? 1280,
      ...(savedState?.x === null || savedState?.x === undefined ? {} : { x: savedState.x }),
      ...(savedState?.y === null || savedState?.y === undefined ? {} : { y: savedState.y }),
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: this.preloadPath,
        sandbox: true,
      },
    })
    this.window = window
    if (savedState?.isMaximized) window.maximize()
    let persistTimer: ReturnType<typeof setTimeout> | null = null
    const persistState = () => {
      if (!this.config || window.isDestroyed()) return
      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = setTimeout(() => {
        persistTimer = null
        if (!this.config || window.isDestroyed()) return
        const bounds = window.getNormalBounds()
        const state: DesktopWindowState = {
          height: bounds.height,
          isMaximized: window.isMaximized(),
          width: bounds.width,
          x: bounds.x,
          y: bounds.y,
        }
        void this.config.setWindowState(state)
      }, 250)
    }
    const persistImmediately = () => {
      if (!this.config || window.isDestroyed()) return
      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = null
      const bounds = window.getNormalBounds()
      const state: DesktopWindowState = {
        height: bounds.height,
        isMaximized: window.isMaximized(),
        width: bounds.width,
        x: bounds.x,
        y: bounds.y,
      }
      void this.config.setWindowState(state)
    }
    window.on('resize', persistState)
    window.on('move', persistState)
    window.on('close', (event) => {
      if (this.shouldHideOnClose()) {
        event.preventDefault()
        window.hide()
      }
      persistImmediately()
    })
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (isSafeExternalUrl(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
    window.webContents.on('will-navigate', (event, url) => {
      if (!isTrustedRendererUrl(url, this.rendererUrl)) event.preventDefault()
    })
    window.webContents.on('will-redirect', (event, url) => {
      if (!isTrustedRendererUrl(url, this.rendererUrl)) event.preventDefault()
    })
    window.on('closed', () => {
      if (this.window === window) this.window = null
    })
    window.once('ready-to-show', () => window.show())
    await window.loadURL(this.rendererUrl)
    return window
  }

  async navigate(url: string) {
    if (!this.window) await this.create()
    await this.window?.loadURL(url)
  }

  focus() {
    if (!this.window) return
    if (this.window.isMinimized()) this.window.restore()
    this.window.show()
    this.window.focus()
  }

  close() {
    this.window?.close()
    this.window = null
  }
}

export const resolvePreloadPath = (mainDir: string) => path.resolve(mainDir, '../preload/index.cjs')
