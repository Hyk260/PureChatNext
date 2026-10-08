import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { app } from 'electron'

const DATA_DIR_NAME = 'Data'
const FILES_DIR_NAME = 'Files'
const CACHE_DIR_NAME = 'Cache'
const TEMP_DIR_NAME = 'PureChat'
const USER_CONFIG_DIR_NAME = '.purechat'

const isInside = (target: string, root: string) => target === root || target.startsWith(`${root}${path.sep}`)

export const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

export const getInstallPath = () => path.dirname(app.getPath('exe'))

export const getFileDir = (filePath: string) => path.dirname(filePath)

export const getFileName = (filePath: string) => path.basename(filePath)

export const getTempDir = () => path.join(app.getPath('temp'), TEMP_DIR_NAME)

export const getDataPath = () => path.join(app.getPath('userData'), DATA_DIR_NAME)

export const getFilesDir = () => path.join(getDataPath(), FILES_DIR_NAME)

export const getCacheDir = () => path.join(app.getPath('userData'), CACHE_DIR_NAME)

export const getMcpDir = () => path.join(os.homedir(), USER_CONFIG_DIR_NAME, 'mcp')

export const getConfigDir = () => path.join(os.homedir(), USER_CONFIG_DIR_NAME, 'config')

export const getAppConfigDir = (name: string) => path.join(getConfigDir(), name)

export const ensureDirectory = async (directory: string) => {
  await mkdir(directory, { recursive: true })
  return directory
}

export const ensureDataPath = () => ensureDirectory(getDataPath())

export interface ResourcePathOptions {
  developmentRoot?: string
  requireExists?: boolean
}

/** Resolve a packaged resource while keeping development and production paths consistent. */
export const getResourcePath = (subPath = '', options: ResourcePathOptions = {}) => {
  const root = path.resolve(
    app.isPackaged ? process.resourcesPath : (options.developmentRoot ?? path.join(app.getAppPath(), 'resources'))
  )
  const resourcePath = path.resolve(root, subPath)

  if (!isInside(resourcePath, root)) return null
  if (options.requireExists && !existsSync(resourcePath)) return null
  return resourcePath
}

const detectUtf16NoBom = (buffer: Buffer): 'utf-16le' | 'utf-16be' | null => {
  const sample = buffer.subarray(0, Math.min(512, buffer.length))
  if (sample.length < 4 || sample.length % 2 !== 0) return null

  let littleEndianPairs = 0
  let bigEndianPairs = 0
  const totalPairs = sample.length / 2

  for (let index = 0; index < sample.length; index += 2) {
    const first = sample[index]
    const second = sample[index + 1]
    if (second === 0 && first !== 0) littleEndianPairs++
    else if (first === 0 && second !== 0) bigEndianPairs++
  }

  if (littleEndianPairs > bigEndianPairs && littleEndianPairs / totalPairs >= 0.3) return 'utf-16le'
  if (bigEndianPairs > littleEndianPairs && bigEndianPairs / totalPairs >= 0.3) return 'utf-16be'
  return null
}

/** Read UTF-8 and UTF-16 text files, including BOM-less UTF-16 exports. */
export const readTextFileWithAutoEncoding = async (filePath: string): Promise<string> => {
  const buffer = await readFile(filePath)

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer.subarray(2))
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer.subarray(2))
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8')
  }

  const utf16Encoding = detectUtf16NoBom(buffer)
  if (utf16Encoding) return new TextDecoder(utf16Encoding).decode(buffer)
  return buffer.toString('utf8')
}
