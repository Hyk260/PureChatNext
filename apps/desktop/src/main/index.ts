import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'

import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  protocol,
  shell,
  Tray,
} from 'electron'

import { registerIpcHandlers } from './ipc'

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

const isSafeExternalUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
  } catch {
    return false
  }
}

const isAllowedRendererUrl = (value: string) => {
  if (value.startsWith(`${protocolScheme}://renderer`)) return true
  if (!app.isPackaged && value.startsWith('http://127.0.0.1:')) return true
  return false
}

const rendererDir = () => path.resolve(mainDir, '../renderer')

const safeRendererFile = (pathname: string) => {
  const normalized = path.posix.normalize(pathname).replace(/^\/+/, '')
  const candidate = path.resolve(rendererDir(), normalized || 'index.html')
  const root = `${path.resolve(rendererDir())}${path.sep}`
  return candidate === path.resolve(rendererDir(), 'index.html') || candidate.startsWith(root) ? candidate : null
}

const handleAppProtocol = async (request: Request) => {
  const url = new URL(request.url)
  const filePath = safeRendererFile(url.pathname)
  if (!filePath) return new Response('Forbidden', { status: 403 })

  let resolvedPath = filePath
  try {
    await fs.access(resolvedPath)
  } catch {
    resolvedPath = path.resolve(rendererDir(), 'index.html')
  }

  const content = await fs.readFile(resolvedPath)
  const extension = path.extname(resolvedPath).toLowerCase()
  const contentTypes: Record<string, string> = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  }
  return new Response(content, {
    headers: { 'Content-Type': contentTypes[extension] || 'application/octet-stream' },
  })
}

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
    if (!isAllowedRendererUrl(url)) event.preventDefault()
  })

  if (app.isPackaged) {
    await mainWindow.loadURL(`${protocolScheme}://renderer/`)
  } else {
    const devUrl = process.env.ELECTRON_RENDERER_URL || `http://127.0.0.1:${process.env.PURECHAT_DESKTOP_VITE_PORT || 5175}`
    await mainWindow.loadURL(devUrl)
  }
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
  protocol.handle(protocolScheme, handleAppProtocol)
  await registerIpcHandlers()
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
