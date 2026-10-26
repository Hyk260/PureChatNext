import { randomUUID } from 'node:crypto'
import path from 'node:path'

import type { DesktopLogRetentionDays } from '@/types/desktop'
import type { DesktopUpdatePreferences } from '@/types/desktopUpdater'
import { DEFAULT_UPDATE_PREFERENCES, isUpdatePreferences, normalizeUpdatePreferences } from '@/types/desktopUpdater'

import Store from 'electron-store'

export interface DesktopProject {
  accessConfirmed: boolean
  createdAt: number
  id: string
  name: string
  rootPath: string
}

export interface DesktopConfig {
  defaultProjectId?: string | null
  updatePreferences?: DesktopUpdatePreferences
  logRetentionDays?: DesktopLogRetentionDays
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
  defaultProjectId: null,
  updatePreferences: DEFAULT_UPDATE_PREFERENCES,
  logRetentionDays: 30,
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
  )
    return null
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
    return [{
      accessConfirmed: project.accessConfirmed === true,
      createdAt: project.createdAt,
      id: project.id,
      name,
      rootPath,
    }]
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

export const isLogRetentionDays = (value: unknown): value is DesktopLogRetentionDays =>
  value === 0 || value === 7 || value === 14 || value === 30 || value === 90

const normalizeLogRetentionDays = (value: unknown): DesktopLogRetentionDays => (isLogRetentionDays(value) ? value : 30)

export class DesktopConfigService {
  readonly configPath: string

  constructor(userDataPath: string) {
    this.store = new Store<DesktopConfig>({
      cwd: userDataPath,
      // 使用独立文件名启用 electron-store 文件级加密，不迁移旧版明文配置。
      name: 'config-encrypted',
      defaults: DEFAULT_CONFIG,
      accessPropertiesByDotNotation: false,
      encryptionKey: 'purechat-desktop-config-encryption-key-v1',
    })
    this.configPath = this.store.path
  }

  private readonly store: Store<DesktopConfig>

  async read(): Promise<DesktopConfig> {
    try {
      const parsed = this.store.store
      const projects = normalizeProjects(parsed.projects)
      return {
        defaultProjectId: projects.some((project) => project.id === parsed.defaultProjectId)
          ? parsed.defaultProjectId
          : null,
        updatePreferences: normalizeUpdatePreferences(parsed.updatePreferences),
        logRetentionDays: normalizeLogRetentionDays(parsed.logRetentionDays),
        pendingAuth: normalizePendingAuth(parsed.pendingAuth),
        permissionScopes:
          parsed.permissionScopes && typeof parsed.permissionScopes === 'object' ? parsed.permissionScopes : {},
        projects,
        remoteServerUrl: parsed.remoteServerUrl ? normalizeRemoteServerUrl(parsed.remoteServerUrl) : null,
        secrets: parsed.secrets && typeof parsed.secrets === 'object' ? parsed.secrets : {},
        windowState: normalizeWindowState(parsed.windowState),
      }
    } catch {
      return { ...DEFAULT_CONFIG, pendingAuth: null, permissionScopes: {}, projects: [], secrets: {} }
    }
  }

  private mutationQueue: Promise<unknown> = Promise.resolve()

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.mutationQueue.then(operation)
    this.mutationQueue = pending.catch(() => undefined)
    return pending
  }

  private update<T>(operation: (config: DesktopConfig) => Promise<T>): Promise<T> {
    return this.enqueue(async () => operation(await this.read()))
  }

  write(config: DesktopConfig) {
    return this.enqueue(() => this.persist(config))
  }

  async setLogRetentionDays(days: DesktopLogRetentionDays) {
    if (!isLogRetentionDays(days)) throw new Error('日志保留期无效')
    await this.update((config) => this.persist({ ...config, logRetentionDays: days }))
  }

  async setUpdatePreferences(preferences: DesktopUpdatePreferences) {
    if (!isUpdatePreferences(preferences)) throw new Error('更新设置无效')
    await this.update((config) =>
      this.persist({ ...config, updatePreferences: normalizeUpdatePreferences(preferences) })
    )
  }

  private async persist(config: DesktopConfig) {
    this.store.store = config
  }

  async setRemoteServer(value: string) {
    return this.update(async (config) => {
      const url = normalizeRemoteServerUrl(value)
      const changed = config.remoteServerUrl !== url
      config.remoteServerUrl = url
      if (changed) {
        for (const key of ['auth.accessToken', 'auth.refreshToken', 'auth.expiresAt']) delete config.secrets[key]
      }
      await this.persist(config)
      return { url }
    })
  }

  async clearRemoteServer() {
    return this.update(async (config) => {
      config.remoteServerUrl = null
      config.pendingAuth = null
      for (const key of Object.keys(config.secrets)) {
        if (key.startsWith('auth.')) {
          delete config.secrets[key]
        }
      }
      await this.persist(config)
      return { url: null }
    })
  }

  async setPendingAuth(pendingAuth: DesktopPendingAuth | null) {
    return this.update(async (config) => {
      await this.persist({ ...config, pendingAuth })
    })
  }

  async clearPendingAuth() {
    await this.setPendingAuth(null)
    await this.deleteSecret('auth.pendingVerifier')
  }

  async storeSecret(key: string, value: string) {
    return this.update(async (config) => {
      // electron-store 会加密整个配置文件，避免访问 macOS Keychain 时弹出授权窗口。
      config.secrets[key] = value
      await this.persist(config)
    })
  }

  async readSecret(key: string): Promise<string | null> {
    const value = (await this.read()).secrets[key]
    return typeof value === 'string' ? value : null
  }

  async deleteSecret(key: string) {
    return this.update(async (config) => {
      delete config.secrets[key]
      await this.persist(config)
    })
  }

  async deleteSecrets(keys: readonly string[]) {
    return this.update(async (config) => {
      for (const key of keys) {
        delete config.secrets[key]
      }
      await this.persist(config)
    })
  }

  async setPermissionScope(topicId: string, scope: string | null) {
    return this.update(async (config) => {
      const permissionScopes = { ...config.permissionScopes }
      if (scope === null) delete permissionScopes[topicId]
      else permissionScopes[topicId] = [scope]
      await this.persist({
        ...config,
        permissionScopes,
      })
      return { scope }
    })
  }

  async listProjects() {
    return (await this.read()).projects
  }

  async getDefaultProject() {
    const config = await this.read()
    return config.projects.find((project) => project.id === config.defaultProjectId) ?? null
  }

  async setDefaultProject(id: string | null) {
    return this.update(async (config) => {
      const project = config.projects.find((item) => item.id === id) ?? null
      if (id !== null && !project) throw new Error('项目不存在')
      await this.persist({ ...config, defaultProjectId: id })
      return project
    })
  }

  async createProject(input: { accessConfirmed?: boolean; name: string; rootPath: string }) {
    return this.update(async (config) => {
      const name = input.name.trim()
      const rootPath = path.resolve(input.rootPath.trim())
      if (!name) throw new Error('项目名称不能为空')
      if (name.length > 80) throw new Error('项目名称过长')
      if (!path.isAbsolute(rootPath)) throw new Error('项目源文件夹路径无效')

      if (config.projects.some((project) => project.rootPath === rootPath)) {
        throw new Error('该源文件夹已添加为项目')
      }

      const project: DesktopProject = {
        accessConfirmed: input.accessConfirmed === true,
        createdAt: Date.now(),
        id: randomUUID(),
        name,
        rootPath,
      }
      await this.persist({ ...config, projects: [project, ...config.projects] })
      return project
    })
  }

  async confirmProjectAccess(id: string, rootPath: string) {
    return this.update(async (config) => {
      const project = config.projects.find((item) => item.id === id)
      if (!project) throw new Error('项目不存在')
      project.rootPath = path.resolve(rootPath)
      project.accessConfirmed = true
      await this.persist({ ...config, projects: [...config.projects] })
      return project
    })
  }

  async deleteProject(id: string) {
    return this.update(async (config) => {
      const projects = config.projects.filter((project) => project.id !== id)
      if (projects.length === config.projects.length) throw new Error('项目不存在')
      const defaultProjectId = config.defaultProjectId === id ? null : config.defaultProjectId
      await this.persist({ ...config, defaultProjectId, projects })
    })
  }

  async setWindowState(windowState: DesktopWindowState) {
    return this.update(async (config) => {
      await this.persist({ ...config, windowState: normalizeWindowState(windowState) })
    })
  }
}
