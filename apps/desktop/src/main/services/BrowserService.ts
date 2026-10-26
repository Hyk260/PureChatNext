import { randomUUID } from 'node:crypto'

import { BrowserWindow, session, shell, WebContentsView } from 'electron'
import type { WebContents, Session } from 'electron'

import type { BrowserCapture, BrowserElement, BrowserLayout, BrowserState } from '@/types/desktopBrowser'
import { isBrowserUrl } from '@/utils/browserUrl'

import { BROWSER_PICKER_SCRIPT, BROWSER_PICKER_WORLD, CANCEL_BROWSER_PICKER } from './browserElementPicker'

interface BrowserPage {
  owner: WebContents
  view: WebContentsView
  partition: Session
  state: BrowserState
  revision: number
  cancelSelection?: () => void
}

export class BrowserService {
  private readonly pages = new Map<string, BrowserPage>()

  constructor(private readonly onState: (owner: WebContents, state: BrowserState) => void) {}

  private page(owner: WebContents, id: string) {
    const page = this.pages.get(id)
    if (!page || page.owner !== owner || page.view.webContents.isDestroyed()) throw new Error('浏览器页面已关闭')
    return page
  }

  private emit(page: BrowserPage) {
    const contents = page.view.webContents
    if (contents.isDestroyed() || !this.pages.has(page.state.sessionId)) return
    page.state = {
      ...page.state,
      url: contents.getURL() || 'about:blank',
      title: contents.getTitle(),
      loading: contents.isLoading(),
      canGoBack: contents.navigationHistory.canGoBack(),
      canGoForward: contents.navigationHistory.canGoForward(),
    }
    this.onState(page.owner, page.state)
  }

  open(owner: WebContents, contextKey: string): BrowserState {
    if (typeof contextKey !== 'string' || !contextKey || contextKey.length > 4096) throw new Error('浏览器会话无效')
    for (const page of this.pages.values()) {
      if (page.owner === owner && page.state.contextKey === contextKey) return page.state
    }
    const window = BrowserWindow.fromWebContents(owner)
    if (!window) throw new Error('浏览器窗口不可用')
    const sessionId = randomUUID()
    const partition = session.fromPartition(`browser-${sessionId}`)
    partition.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    partition.setPermissionCheckHandler(() => false)
    partition.on('will-download', (event) => event.preventDefault())
    const view = new WebContentsView({
      webPreferences: {
        session: partition,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        webviewTag: false,
        safeDialogs: true,
      },
    })
    const state: BrowserState = {
      sessionId,
      contextKey,
      url: 'about:blank',
      title: '',
      loading: false,
      canGoBack: false,
      canGoForward: false,
    }
    const page: BrowserPage = { owner, view, partition, state, revision: 0 }
    this.pages.set(sessionId, page)
    view.setVisible(false)
    window.contentView.addChildView(view)
    const contents = view.webContents
    contents.setWindowOpenHandler(({ url }) => {
      if (isBrowserUrl(url)) this.navigate(owner, sessionId, url).catch(() => undefined)
      return { action: 'deny' }
    })
    const guard = (event: Electron.Event, url: string) => {
      if (!isBrowserUrl(url)) event.preventDefault()
    }
    contents.on('will-navigate', guard)
    contents.on('will-redirect', guard)
    contents.on('will-frame-navigate', (event) => guard(event, event.url))
    contents.on('will-attach-webview', (event) => event.preventDefault())
    contents.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => {
      if (!isMainFrame) return
      page.revision += 1
      this.cancelPick(owner, sessionId)
      page.state.error = undefined
    })
    contents.on('did-start-loading', () => this.emit(page))
    contents.on('did-stop-loading', () => this.emit(page))
    contents.on('did-navigate-in-page', () => this.emit(page))
    contents.on('page-title-updated', () => this.emit(page))
    contents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
      if (!isMainFrame || code === -3) return
      page.state.error = `网页加载失败：${description}`
      this.emit(page)
    })
    contents.on('render-process-gone', () => {
      page.state.error = '网页进程已退出，请刷新重试'
      this.cancelPick(owner, sessionId)
      this.emit(page)
    })
    contents.loadURL('about:blank').catch(() => undefined)
    return state
  }

  async navigate(owner: WebContents, id: string, url: string) {
    if (typeof url !== 'string' || url.length > 8192 || !isBrowserUrl(url)) throw new Error('仅支持 HTTP 和 HTTPS 网址')
    const page = this.page(owner, id)
    this.cancelPick(owner, id)
    page.state.error = undefined
    try {
      await page.view.webContents.loadURL(url)
    } catch (error) {
      if (error instanceof Error && error.message.includes('ERR_ABORTED')) return
      throw error
    }
  }

  action(owner: WebContents, id: string, action: 'back' | 'forward' | 'reload' | 'stop') {
    const page = this.page(owner, id)
    const contents = page.view.webContents
    this.cancelPick(owner, id)
    if (action === 'back' && contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack()
    if (action === 'forward' && contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward()
    if (action === 'reload') {
      page.state.error = undefined
      contents.reload()
    }
    if (action === 'stop') contents.stop()
  }

  layout(owner: WebContents, input: BrowserLayout) {
    if (!input) throw new Error('浏览器布局无效')
    const page = this.page(owner, input.sessionId)
    const window = BrowserWindow.fromWebContents(owner)
    if (!window) return
    const values = [input.x, input.y, input.width, input.height]
    if (typeof input.visible !== 'boolean' || !values.every(Number.isFinite)) throw new Error('浏览器布局无效')
    const factor = owner.getZoomFactor()
    const bounds = window.getContentBounds()
    const x = Math.max(0, Math.round(input.x * factor))
    const y = Math.max(0, Math.round(input.y * factor))
    const width = Math.max(0, Math.min(Math.round(input.width * factor), bounds.width - x))
    const height = Math.max(0, Math.min(Math.round(input.height * factor), bounds.height - y))
    if (input.visible) {
      for (const other of this.pages.values()) if (other !== page && other.owner === owner) other.view.setVisible(false)
    } else {
      this.cancelPick(owner, input.sessionId)
    }
    page.view.setBounds({ x, y, width, height })
    page.view.setVisible(input.visible && width > 0 && height > 0)
  }

  async capture(owner: WebContents, id: string): Promise<BrowserCapture> {
    const page = this.page(owner, id)
    const revision = page.revision
    await this.cancelPick(owner, id)
    let image = await page.view.webContents.capturePage()
    if (this.page(owner, id) !== page || page.revision !== revision) throw new Error('页面已变化，请重新截图')
    if (image.isEmpty()) throw new Error('截图为空，请稍后重试')
    if (image.getSize().width > 1920) image = image.resize({ width: 1920 })
    const png = image.toPNG()
    if (png.byteLength > 10 * 1024 * 1024) throw new Error('截图超过 10MB 限制')
    return { dataUrl: `data:image/png;base64,${png.toString('base64')}`, title: page.state.title }
  }

  async openExternal(owner: WebContents, id: string) {
    const url = this.page(owner, id).view.webContents.getURL()
    if (url === 'about:blank' || !isBrowserUrl(url)) throw new Error('当前页面无法在系统浏览器中打开')
    await shell.openExternal(url)
  }

  async pick(owner: WebContents, id: string): Promise<BrowserElement | null> {
    const page = this.page(owner, id)
    this.cancelPick(owner, id)
    const revision = page.revision
    let cancel: () => void = () => undefined
    const cancelled = new Promise<null>((resolve) => {
      cancel = () => resolve(null)
    })
    page.cancelSelection = cancel
    try {
      const raw: unknown = await Promise.race([
        page.view.webContents.executeJavaScriptInIsolatedWorld(BROWSER_PICKER_WORLD, [{ code: BROWSER_PICKER_SCRIPT }]),
        cancelled,
      ])
      if (!raw || !this.pages.has(id) || page.revision !== revision) return null
      if (typeof raw !== 'object') throw new Error('页面元素数据无效')
      const payload = raw as Record<string, unknown>
      const read = (key: string, length: number) =>
        typeof payload[key] === 'string' ? payload[key].slice(0, length) : ''
      return {
        url: page.view.webContents.getURL(),
        pageTitle: page.view.webContents.getTitle().slice(0, 500),
        tag: read('tag', 80),
        selector: read('selector', 1000),
        text: read('text', 6000),
        html: read('html', 2000),
      }
    } catch (error) {
      if (!this.pages.has(id) || page.revision !== revision) return null
      throw error
    } finally {
      if (page.cancelSelection === cancel) {
        page.cancelSelection = undefined
        this.stopPicker(page)
      }
    }
  }

  private stopPicker(page: BrowserPage) {
    if (page.view.webContents.isDestroyed()) return Promise.resolve()
    return page.view.webContents
      .executeJavaScriptInIsolatedWorld(BROWSER_PICKER_WORLD, [{ code: CANCEL_BROWSER_PICKER }])
      .catch(() => undefined)
  }

  cancelPick(owner: WebContents, id: string) {
    const page = this.page(owner, id)
    if (!page.cancelSelection) return Promise.resolve()
    page.cancelSelection()
    page.cancelSelection = undefined
    return this.stopPicker(page)
  }

  async close(owner: WebContents, id: string) {
    const page = this.pages.get(id)
    if (!page) return
    if (page.owner !== owner) throw new Error('浏览器页面不属于当前窗口')
    page.cancelSelection?.()
    page.cancelSelection = undefined
    this.stopPicker(page)
    this.pages.delete(id)
    if (!owner.isDestroyed()) BrowserWindow.fromWebContents(owner)?.contentView.removeChildView(page.view)
    if (!page.view.webContents.isDestroyed()) page.view.webContents.close({ waitForBeforeUnload: false })
    await page.partition.clearStorageData()
    await page.partition.clearCache()
  }

  async reset(owner?: WebContents) {
    const pending = [...this.pages.values()].filter((page) => !owner || page.owner === owner)
    await Promise.all(pending.map((page) => this.close(page.owner, page.state.sessionId)))
  }
}
