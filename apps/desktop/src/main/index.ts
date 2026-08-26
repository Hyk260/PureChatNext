import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  protocol,
  shell,
  session,
  Tray,
} from 'electron'

import { registerIpcHandlers } from './ipc'
import { createAppProtocolHandler } from './appProtocol'
import { APP_RENDERER_URL, isSafeExternalUrl, isTrustedRendererUrl } from './rendererSecurity'

const mainDir = path.dirname(fileURLToPath(import.meta.url))
const protocolScheme = 'purechat'

protocol.registerSchemesAsPrivileged([
  {
    scheme: protocolScheme,
    privileges: { corsEnabled: true, secure: true, standard: true, supportFetchAPI: true, stream: true },
  },
])

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const rendererUrl = app.isPackaged
  ? APP_RENDERER_URL
  : process.env.ELECTRON_RENDERER_URL || `http://127.0.0.1:${process.env.PURECHAT_DESKTOP_VITE_PORT || 5176}`

const createTray = () => {
  tray = new Tray(
    nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    )
  )
  tray.setToolTip('PureChat')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { click: () => mainWindow?.show(), label: '打开 PureChat' },
      { click: () => app.quit(), label: '退出' },
    ])
  )
  tray.on('click', () => mainWindow?.show())
}

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    height: 800,
    minHeight: 520,
    minWidth: 860,
    show: false,
    title: 'PureChat',
    width: 1280,
    webPreferences: {
      contextIsolation: true,
      preload: path.resolve(mainDir, '../preload/index.cjs'),
      sandbox: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url, rendererUrl)) event.preventDefault()
  })
  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (!isTrustedRendererUrl(url, rendererUrl)) event.preventDefault()
  })

  await mainWindow.loadURL(rendererUrl)
}

const bootstrap = async () => {
  const singleInstance = app.requestSingleInstanceLock()
  if (!singleInstance) {
    app.quit()
    return
  }

  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  await app.whenReady()
  if (!isTrustedRendererUrl(rendererUrl, rendererUrl)) throw new Error('非法的桌面渲染页地址')
  const { getRemoteServerUrl } = await registerIpcHandlers({
    getTrustedContents: () => mainWindow?.webContents ?? null,
    rendererUrl,
  })
  protocol.handle(protocolScheme, createAppProtocolHandler({
    fetch: (input, init) => session.defaultSession.fetch(input, init),
    getRemoteServerUrl,
    rendererDir: path.resolve(mainDir, '../renderer'),
  }))
  await createWindow()
  createTray()

  app.on('activate', () => {
    if (!mainWindow) void createWindow()
    else mainWindow.show()
  })
}

void bootstrap()

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
