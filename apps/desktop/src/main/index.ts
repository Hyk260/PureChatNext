import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { app } from 'electron'

import { DesktopApp } from './core/DesktopApp'

const mainDir = path.dirname(fileURLToPath(import.meta.url))
const desktopApp = new DesktopApp(mainDir)

void desktopApp.bootstrap().catch((error) => {
  console.error('PureChat desktop bootstrap failed', error)
  app.quit()
})
