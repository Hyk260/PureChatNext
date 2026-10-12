import path from 'node:path'

import { app } from 'electron'
import log from 'electron-log'

const LOG_FILE_MAX_SIZE = 10 * 1024 * 1024
const LOG_DIR_NAME = 'log'
const LOG_FORMAT = '{y}-{m}-{d} {h}:{i}:{s} [{level}]{scope} {text}'
let redactionInstalled = false

/** Updater diagnostics may contain signed URLs; keep only their origin and path. */
export const redactLogText = (text: string) =>
  text.replace(/https?:\/\/[^\s"'<>]+/g, (value) => {
    const suffix = /[),.;:]+$/.exec(value)?.[0] || ''
    try {
      const url = new URL(value.slice(0, value.length - suffix.length))
      url.username = ''
      url.password = ''
      url.search = ''
      url.hash = ''
      return url.href + suffix
    } catch {
      return '[invalid URL]'
    }
  })

const redactValue = (value: unknown): unknown => {
  if (typeof value === 'string') return redactLogText(value)
  if (value instanceof Error) {
    return {
      name: value.name,
      code: 'code' in value ? value.code : undefined,
      message: redactLogText(value.message),
      stack: value.stack ? redactLogText(value.stack) : undefined,
    }
  }
  return value
}

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
 * Configure timestamped main-process transports and URL redaction.
 * `rootDir` points to the application data directory, not the log directory.
 */
export const initializeLogger = (rootDir = app.getPath('userData')) => {
  const logDir = getLogDirectory(rootDir)

  log.transports.file.maxSize = LOG_FILE_MAX_SIZE
  log.transports.file.format = LOG_FORMAT
  log.transports.console.format = LOG_FORMAT
  log.transports.file.resolvePathFn = () => path.join(logDir, `${getDateString()}.log`)
  log.scope.labelPadding = false
  if (!redactionInstalled) {
    log.hooks.push((message) => ({ ...message, data: message.data.map(redactValue) }))
    redactionInstalled = true
  }
}

export const createLogger = (scope: string, rootDir = app.getPath('userData')) => {
  initializeLogger(rootDir)
  return log.scope(scope)
}
