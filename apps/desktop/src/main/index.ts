import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { app } from 'electron'

import { DesktopApp } from './core/DesktopApp'

// 必须在 ready 之前设置，否则原生文件对话框（Cancel/Open/Favorites 等）会跟英文 locale
app.commandLine.appendSwitch('lang', 'zh-CN')

if (!app.isPackaged) {
  // 开发版始终使用独立数据目录，避免与安装版的配置、日志和本地缓存互相覆盖。
  app.setPath('userData', `${app.getPath('userData')}-dev`)
}

const mainDir = path.dirname(fileURLToPath(import.meta.url))
const desktopApp = new DesktopApp(mainDir)

desktopApp.bootstrap().catch((error) => {
  console.error('PureChat desktop bootstrap failed', error)
  app.quit()
})
