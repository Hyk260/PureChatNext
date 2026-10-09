import { promises as fs } from 'node:fs'
import path from 'node:path'

import { app, shell } from 'electron'

import type { DesktopDataDirectory, DesktopDataInfo, DesktopLogRetentionDays } from '@/types/desktop'

import { createLogger, getLogDirectory } from '../logger'
import { ensureDirectory } from '../utils/file'
import { isLogRetentionDays } from './DesktopConfigService'
import type { DesktopConfigService } from './DesktopConfigService'

const CLEANUP_INTERVAL = 12 * 60 * 60 * 1000
const LOG_NAME = /^(\d{4})-(\d{2})-(\d{2})(?:\.old)?\.log$/

export function isExpiredLog(name: string, days: DesktopLogRetentionDays, now: Date): boolean {
  if (days === 0) return false
  const match = LOG_NAME.exec(name)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return false
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  cutoff.setDate(cutoff.getDate() - days)
  return date < cutoff
}

export async function cleanupLogs(
  directory: string,
  days: DesktopLogRetentionDays,
  now: Date,
  onError: (error: unknown) => void
) {
  if (days === 0) return
  try {
    if ((await fs.lstat(directory)).isSymbolicLink()) return
    const entries = await fs.readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile() || !isExpiredLog(entry.name, days, now)) continue
      try {
        await fs.unlink(path.join(directory, entry.name))
      } catch (error) {
        onError(error)
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') onError(error)
  }
}

export class DesktopDataService {
  private timer: ReturnType<typeof setInterval> | null = null
  private cleaningCache: Promise<void> | null = null
  private readonly logger = createLogger('DesktopData')

  constructor(
    private readonly config: DesktopConfigService,
    private readonly getContents: () => Electron.WebContents | null
  ) {}

  private getSession() {
    const contents = this.getContents()
    if (!contents || contents.isDestroyed()) throw new Error('桌面窗口不可用，请重试')
    return contents.session
  }

  async getInfo(): Promise<DesktopDataInfo> {
    const config = await this.config.read()
    let cacheBytes: number | null = null
    try {
      cacheBytes = await this.getSession().getCacheSize()
    } catch (error) {
      this.logger.warn('无法统计 HTTP 缓存', error)
    }
    return {
      dataPath: app.getPath('userData'),
      logsPath: getLogDirectory(),
      logRetentionDays: config.logRetentionDays ?? 30,
      cacheBytes,
    }
  }

  async openDirectory(directory: DesktopDataDirectory) {
    if (directory !== 'data' && directory !== 'logs') throw new Error('数据目录类型无效')
    const target = directory === 'data' ? app.getPath('userData') : getLogDirectory()
    await ensureDirectory(target)
    const error = await shell.openPath(target)
    if (error) throw new Error(error)
  }

  async setLogRetention(days: DesktopLogRetentionDays) {
    if (!isLogRetentionDays(days)) throw new Error('日志保留期无效')
    await this.config.setLogRetentionDays(days)
    await this.cleanup()
  }

  clearHttpCache(): Promise<void> {
    if (this.cleaningCache) return this.cleaningCache
    this.cleaningCache = this.getSession()
      .clearCache()
      .finally(() => {
        this.cleaningCache = null
      })
    return this.cleaningCache
  }

  async cleanup() {
    const config = await this.config.read()
    await cleanupLogs(getLogDirectory(), config.logRetentionDays ?? 30, new Date(), (error) => {
      this.logger.warn('清理过期日志失败，将在下次重试', error)
    })
  }

  async start() {
    await this.cleanup()
    this.timer = setInterval(() => {
      this.cleanup().catch((error) => this.logger.warn('日志清理失败', error))
    }, CLEANUP_INTERVAL)
    this.timer.unref()
  }

  dispose() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
