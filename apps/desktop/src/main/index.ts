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
import { installApplicationMenu } from './applicationMenu'
import { createAppProtocolHandler } from './appProtocol'
import { protocolLinksFromCommandLine, resolveProtocolLink } from './protocolLink'
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
let isQuitting = false
const pendingProtocolLinks = protocolLinksFromCommandLine(process.argv)
  .map(resolveProtocolLink)
  .filter((url): url is string => Boolean(url))

const focusMainWindow = () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

const openProtocolLinks = (links: readonly string[]) => {
  const rendererLinks = links.map(resolveProtocolLink).filter((url): url is string => Boolean(url))
  if (rendererLinks.length === 0) return

  if (!mainWindow) {
    pendingProtocolLinks.push(...rendererLinks)
    return
  }

  focusMainWindow()
  const url = rendererLinks.at(-1)
  if (url) void mainWindow.loadURL(url)
}

app.on('open-url', (event, url) => {
  event.preventDefault()
  openProtocolLinks([url])
})

const rendererUrl = app.isPackaged
  ? APP_RENDERER_URL
  : process.env.ELECTRON_RENDERER_URL || `http://127.0.0.1:${process.env.PURECHAT_DESKTOP_VITE_PORT || 5176}`

const getDesktopResourcePath = (name: string) => app.isPackaged
  ? path.join(process.resourcesPath, name)
  : path.resolve(mainDir, '../../build', name)

const getAppIconPath = () => getDesktopResourcePath(app.isPackaged ? 'purechat-appicon.png' : 'icon.png')

const getTrayImage = () => {
  const image = nativeImage.createFromPath(getDesktopResourcePath('tray.png'))
  // Keep the white mark as-is so it remains visible on a dark macOS menu bar.
  return image.resize({ height: 16 })
}

const createTray = () => {
  tray = new Tray(getTrayImage())
  tray.setToolTip('PureChat')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { click: focusMainWindow, label: '打开 PureChat' },
      { click: () => app.quit(), label: '退出 PureChat' },
    ])
  )
  tray.on('click', focusMainWindow)
}

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    height: 800,
    icon: getAppIconPath(),
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

  mainWindow.on('close', (event) => {
    if (!isQuitting && tray) {
      event.preventDefault()
      mainWindow?.hide()
    }
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
  const initialLink = pendingProtocolLinks.pop()
  if (initialLink) await mainWindow.loadURL(initialLink)
}

const registerProtocolClient = () => {
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient(protocolScheme, process.execPath, [path.resolve(process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(protocolScheme)
  }
}

const bootstrap = async () => {
  const singleInstance = app.requestSingleInstanceLock()
  if (!singleInstance) {
    app.quit()
    return
  }

  app.on('second-instance', (_event, commandLine) => {
    openProtocolLinks(protocolLinksFromCommandLine(commandLine))
    focusMainWindow()
  })

  await app.whenReady()
  installApplicationMenu()
  app.on('before-quit', () => {
    isQuitting = true
  })
  registerProtocolClient()
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
  if (process.platform !== 'darwin' && !tray) app.quit()
})
