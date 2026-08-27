import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface DesktopConfig {
  permissionScopes: Record<string, string[]>
  remoteServerUrl: string | null
  secrets: Record<string, string>
  windowState?: DesktopWindowState | null
}

export interface DesktopWindowState {
  height: number
  isMaximized: boolean
  width: number
  x: number | null
  y: number | null
}

export const DEFAULT_CONFIG: DesktopConfig = {
  permissionScopes: {},
  remoteServerUrl: process.env.PURECHAT_DESKTOP_REMOTE_URL?.trim() || null,
  secrets: {},
  windowState: null,
}

const normalizeWindowState = (value: unknown): DesktopWindowState | null => {
  if (!value || typeof value !== 'object') return null
  const state = value as Partial<DesktopWindowState>
  if (
    typeof state.width !== 'number' ||
    typeof state.height !== 'number' ||
    !Number.isFinite(state.width) ||
    !Number.isFinite(state.height)
  ) {
    return null
  }
  return {
    height: Math.min(2160, Math.max(520, Math.round(state.height))),
    isMaximized: state.isMaximized === true,
    width: Math.min(3840, Math.max(860, Math.round(state.width))),
    x: typeof state.x === 'number' && Number.isFinite(state.x) ? Math.round(state.x) : null,
    y: typeof state.y === 'number' && Number.isFinite(state.y) ? Math.round(state.y) : null,
  }
}

export const normalizeRemoteServerUrl = (value: string): string => {
  const url = new URL(value.trim())
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('远程服务地址必须使用 http 或 https')
  if (url.username || url.password || url.hash) throw new Error('远程服务地址不能包含凭据或 hash')
  return url.toString().replace(/\/$/, '')
}

export class DesktopConfigService {
  readonly configPath: string

  constructor(userDataPath: string) {
    this.configPath = path.join(userDataPath, 'config.json')
    this.userDataPath = userDataPath
  }

  private readonly userDataPath: string

  async read(): Promise<DesktopConfig> {
    try {
      const raw = await fs.readFile(this.configPath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<DesktopConfig>
      return {
        permissionScopes:
          parsed.permissionScopes && typeof parsed.permissionScopes === 'object' ? parsed.permissionScopes : {},
        remoteServerUrl: parsed.remoteServerUrl ? normalizeRemoteServerUrl(parsed.remoteServerUrl) : null,
        secrets: parsed.secrets && typeof parsed.secrets === 'object' ? parsed.secrets : {},
        windowState: normalizeWindowState(parsed.windowState),
      }
    } catch {
      return { ...DEFAULT_CONFIG, permissionScopes: {}, secrets: {} }
    }
  }

  async write(config: DesktopConfig) {
    await fs.mkdir(this.userDataPath, { recursive: true })
    const tempPath = `${this.configPath}.tmp`
    await fs.writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
    await fs.rename(tempPath, this.configPath)
  }

  async setRemoteServer(value: string) {
    const url = normalizeRemoteServerUrl(value)
    const config = await this.read()
    await this.write({ ...config, remoteServerUrl: url })
    return { url }
  }

  async setPermissionScope(topicId: string, scope: string) {
    const config = await this.read()
    await this.write({
      ...config,
      permissionScopes: { ...config.permissionScopes, [topicId]: [scope] },
    })
    return { scope }
  }

  async setWindowState(windowState: DesktopWindowState) {
    const config = await this.read()
    await this.write({ ...config, windowState: normalizeWindowState(windowState) })
  }
}
