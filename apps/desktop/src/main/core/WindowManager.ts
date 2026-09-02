import path from 'node:path'

import { BrowserWindow, shell } from 'electron'

import { isSafeExternalUrl, isTrustedRendererUrl } from '../security/RendererSecurity'
import type { DesktopConfigService, DesktopWindowState } from '../services/DesktopConfigService'
import {
  getRendererReloadDelayMs,
  MAX_RENDERER_RELOAD_ATTEMPTS,
  shouldRetryRendererLoad,
} from './rendererLoadRetry'

export class WindowManager {
  private window: BrowserWindow | null = null
  private rendererReloadAttempts = 0
  private rendererReloadTimer: ReturnType<typeof setTimeout> | null = null

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
      if (this.rendererReloadTimer) {
        clearTimeout(this.rendererReloadTimer)
        this.rendererReloadTimer = null
      }
      if (this.window === window) this.window = null
    })
    window.webContents.on('did-finish-load', () => {
      this.rendererReloadAttempts = 0
    })
    window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || window.isDestroyed()) return
      if (validatedURL && !isTrustedRendererUrl(validatedURL, this.rendererUrl)) return

      if (!shouldRetryRendererLoad(errorCode, this.rendererReloadAttempts)) {
        console.error('Renderer failed to load', errorCode, errorDescription, validatedURL)
        if (!window.isVisible()) window.show()
        return
      }

      this.rendererReloadAttempts += 1
      const delayMs = getRendererReloadDelayMs(this.rendererReloadAttempts)
      console.warn(
        `Renderer load failed (${errorCode} ${errorDescription}); retry ${this.rendererReloadAttempts}/${MAX_RENDERER_RELOAD_ATTEMPTS} in ${delayMs}ms`
      )
      if (this.rendererReloadTimer) clearTimeout(this.rendererReloadTimer)
      this.rendererReloadTimer = setTimeout(() => {
        this.rendererReloadTimer = null
        if (!window.isDestroyed()) void window.loadURL(this.rendererUrl)
      }, delayMs)
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
