import path from 'node:path'

import { app } from 'electron'
import log from 'electron-log'

const LOG_FILE_MAX_SIZE = 10 * 1024 * 1024
const LOG_DIR_NAME = 'log'

const getDateString = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const getLogDirectory = (rootDir = app.getPath('userData')) =>
  path.join(path.resolve(rootDir), LOG_DIR_NAME, app.isPackaged ? 'pro' : 'dev')

/**
 * Configure the main-process logger and return a scoped logger.
 * `rootDir` points to the application data directory, not the log directory.
 */
export const createLogger = (scope: string, rootDir = app.getPath('userData')) => {
  const logDir = getLogDirectory(rootDir)

  log.transports.file.maxSize = LOG_FILE_MAX_SIZE
  log.transports.file.format = '{text}'
  log.transports.file.resolvePathFn = () => path.join(logDir, `${getDateString()}.log`)

  return log.scope(scope)
}
