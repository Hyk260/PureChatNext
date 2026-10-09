import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import { safeStorage } from 'electron'

import { ensureDirectory } from '../utils/file'

export interface DesktopProject {
  createdAt: number
  id: string
  name: string
  rootPath: string
}

export interface DesktopConfig {
  pendingAuth?: DesktopPendingAuth | null
  permissionScopes: Record<string, string[]>
  projects: DesktopProject[]
  remoteServerUrl: string | null
  secrets: Record<string, string>
  windowState?: DesktopWindowState | null
}

export interface DesktopPendingAuth {
  expiresAt: number
  redirectUri: string
  serverUrl: string
  state: string
}

export interface DesktopWindowState {
  height: number
  isMaximized: boolean
  width: number
  x: number | null
  y: number | null
}

export const DEFAULT_CONFIG: DesktopConfig = {
  pendingAuth: null,
  permissionScopes: {},
  projects: [],
  remoteServerUrl: process.env.PURECHAT_DESKTOP_REMOTE_URL?.trim() || null,
  secrets: {},
  windowState: null,
}

const normalizePendingAuth = (value: unknown): DesktopPendingAuth | null => {
  if (!value || typeof value !== 'object') return null
  const pending = value as Partial<DesktopPendingAuth>
  if (
    typeof pending.expiresAt !== 'number' ||
    typeof pending.redirectUri !== 'string' ||
    typeof pending.serverUrl !== 'string' ||
    typeof pending.state !== 'string'
  ) return null
  if (pending.expiresAt <= Date.now()) return null
  return {
    expiresAt: pending.expiresAt,
    redirectUri: pending.redirectUri,
    serverUrl: pending.serverUrl,
    state: pending.state,
  }
}

const normalizeProjects = (value: unknown): DesktopProject[] => {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const project = item as Partial<DesktopProject>
    if (
      typeof project.id !== 'string' ||
      typeof project.name !== 'string' ||
      typeof project.rootPath !== 'string' ||
      typeof project.createdAt !== 'number'
    ) {
      return []
    }
    const name = project.name.trim()
    const rootPath = project.rootPath.trim()
    if (!name || !rootPath || !path.isAbsolute(rootPath)) return []
    return [{ createdAt: project.createdAt, id: project.id, name, rootPath }]
  })
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
        pendingAuth: normalizePendingAuth(parsed.pendingAuth),
        permissionScopes:
          parsed.permissionScopes && typeof parsed.permissionScopes === 'object' ? parsed.permissionScopes : {},
        projects: normalizeProjects(parsed.projects),
        remoteServerUrl: parsed.remoteServerUrl ? normalizeRemoteServerUrl(parsed.remoteServerUrl) : null,
        secrets: parsed.secrets && typeof parsed.secrets === 'object' ? parsed.secrets : {},
        windowState: normalizeWindowState(parsed.windowState),
      }
    } catch {
      return { ...DEFAULT_CONFIG, pendingAuth: null, permissionScopes: {}, projects: [], secrets: {} }
    }
  }

  async write(config: DesktopConfig) {
    await ensureDirectory(this.userDataPath)
    const tempPath = path.join(this.userDataPath, `config.${randomUUID()}.tmp`)
    await fs.writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
    try {
      await fs.rename(tempPath, this.configPath)
    } catch (error) {
      await fs.unlink(tempPath).catch(() => undefined)
      throw error
    }
  }

  async setRemoteServer(value: string) {
    const url = normalizeRemoteServerUrl(value)
    const config = await this.read()
    const changed = config.remoteServerUrl !== url
    await this.write({ ...config, remoteServerUrl: url })
    if (changed) {
      await this.deleteSecrets(['auth.accessToken', 'auth.refreshToken', 'auth.expiresAt'])
    }
    return { url }
  }

  async setPendingAuth(pendingAuth: DesktopPendingAuth | null) {
    const config = await this.read()
    await this.write({ ...config, pendingAuth })
  }

  async clearPendingAuth() {
    await this.setPendingAuth(null)
    await this.deleteSecret('auth.pendingVerifier')
  }

  async storeSecret(key: string, value: string) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('当前系统没有可用的安全存储，未保存敏感信息')
    const config = await this.read()
    config.secrets[key] = `safe:${safeStorage.encryptString(value).toString('base64')}`
    await this.write(config)
  }

  async readSecret(key: string): Promise<string | null> {
    const value = (await this.read()).secrets[key]
    if (!value?.startsWith('safe:') || !safeStorage.isEncryptionAvailable()) return null
    try {
      return safeStorage.decryptString(Buffer.from(value.slice(5), 'base64'))
    } catch {
      return null
    }
  }

  async deleteSecret(key: string) {
    const config = await this.read()
    delete config.secrets[key]
    await this.write(config)
  }

  async deleteSecrets(keys: readonly string[]) {
    const config = await this.read()
    for (const key of keys) delete config.secrets[key]
    await this.write(config)
  }

  async setPermissionScope(topicId: string, scope: string) {
    const config = await this.read()
    await this.write({
      ...config,
      permissionScopes: { ...config.permissionScopes, [topicId]: [scope] },
    })
    return { scope }
  }

  async listProjects() {
    return (await this.read()).projects
  }

  async createProject(input: { name: string; rootPath: string }) {
    const name = input.name.trim()
    const rootPath = path.resolve(input.rootPath.trim())
    if (!name) throw new Error('项目名称不能为空')
    if (name.length > 80) throw new Error('项目名称过长')
    if (!path.isAbsolute(rootPath)) throw new Error('项目源文件夹路径无效')

    const config = await this.read()
    if (config.projects.some((project) => project.rootPath === rootPath)) {
      throw new Error('该源文件夹已添加为项目')
    }

    const project: DesktopProject = {
      createdAt: Date.now(),
      id: randomUUID(),
      name,
      rootPath,
    }
    await this.write({ ...config, projects: [project, ...config.projects] })
    return project
  }

  async deleteProject(id: string) {
    const config = await this.read()
    const projects = config.projects.filter((project) => project.id !== id)
    if (projects.length === config.projects.length) throw new Error('项目不存在')
    await this.write({ ...config, projects })
  }

  async setWindowState(windowState: DesktopWindowState) {
    const config = await this.read()
    await this.write({ ...config, windowState: normalizeWindowState(windowState) })
  }
}
