import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { app } from 'electron'

import { DesktopApp } from './core/DesktopApp'

// 必须在 ready 之前设置，否则原生文件对话框（Cancel/Open/Favorites 等）会跟英文 locale
app.commandLine.appendSwitch('lang', 'zh-CN')

const mainDir = path.dirname(fileURLToPath(import.meta.url))
const desktopApp = new DesktopApp(mainDir)

void desktopApp.bootstrap().catch((error) => {
  console.error('PureChat desktop bootstrap failed', error)
  app.quit()
})
