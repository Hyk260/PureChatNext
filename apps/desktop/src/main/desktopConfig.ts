import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface DesktopConfig {
  remoteServerUrl: string | null
  secrets: Record<string, string>
}

export const DEFAULT_CONFIG: DesktopConfig = {
  remoteServerUrl: process.env.PURECHAT_DESKTOP_REMOTE_URL?.trim() || null,
  secrets: {},
}

export const normalizeRemoteServerUrl = (value: string): string => {
  const url = new URL(value.trim())
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('远程服务地址必须使用 http 或 https')
  }
  if (url.username || url.password || url.hash) {
    throw new Error('远程服务地址不能包含凭据或 hash')
  }
  return url.toString().replace(/\/$/, '')
}

export const createConfigStore = async (userDataPath: string) => {
  const configPath = path.join(userDataPath, 'config.json')

  const read = async (): Promise<DesktopConfig> => {
    try {
      const raw = await fs.readFile(configPath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<DesktopConfig>
      return {
        remoteServerUrl: parsed.remoteServerUrl ? normalizeRemoteServerUrl(parsed.remoteServerUrl) : null,
        secrets: parsed.secrets && typeof parsed.secrets === 'object' ? parsed.secrets : {},
      }
    } catch {
      return { ...DEFAULT_CONFIG, secrets: {} }
    }
  }

  const write = async (config: DesktopConfig) => {
    await fs.mkdir(userDataPath, { recursive: true })
    const tempPath = `${configPath}.tmp`
    await fs.writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
    await fs.rename(tempPath, configPath)
  }

  return { configPath, read, write }
}
