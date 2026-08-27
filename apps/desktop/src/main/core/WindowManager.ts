import path from 'node:path'

import { BrowserWindow, shell } from 'electron'

import { isSafeExternalUrl, isTrustedRendererUrl } from '../security/RendererSecurity'

export class WindowManager {
  private window: BrowserWindow | null = null

  constructor(
    private readonly rendererUrl: string,
    private readonly preloadPath: string,
    private readonly iconPath: string,
    private readonly shouldHideOnClose: () => boolean = () => false
  ) {}

  get trustedContents() {
    return this.window?.webContents ?? null
  }

  get isOpen() {
    return this.window !== null
  }

  async create() {
    if (this.window) return this.window
    const window = new BrowserWindow({
      height: 800,
      icon: this.iconPath,
      minHeight: 520,
      minWidth: 860,
      show: false,
      title: 'PureChat',
      width: 1280,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: this.preloadPath,
        sandbox: true,
      },
    })
    this.window = window
    window.on('close', (event) => {
      if (this.shouldHideOnClose()) {
        event.preventDefault()
        window.hide()
      }
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
