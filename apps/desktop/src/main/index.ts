import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { app } from 'electron'

import { DesktopApp } from './core/DesktopApp'
import { createLogger } from './logger'

// 必须在 ready 之前设置，否则原生文件对话框（Cancel/Open/Favorites 等）会跟英文 locale
app.commandLine.appendSwitch('lang', 'zh-CN')

if (!app.isPackaged) {
  // 开发版始终使用独立数据目录，避免与安装版的配置、日志和本地缓存互相覆盖。
  app.setPath('userData', `${app.getPath('userData')}-dev`)
}

const mainDir = path.dirname(fileURLToPath(import.meta.url))
const logger = createLogger('desktop:app')
logger.info('Starting PureChat desktop', {
  version: app.getVersion(),
  packaged: app.isPackaged,
  platform: process.platform,
  arch: process.arch,
})
const bootstrap = async () => {
  const desktopApp = new DesktopApp(mainDir)
  await desktopApp.bootstrap()
}

bootstrap().catch((error) => {
  logger.error('PureChat desktop bootstrap failed', error)
  app.quit()
})
