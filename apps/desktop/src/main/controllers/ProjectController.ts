import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { DesktopProjectEntries, DesktopProjectFile } from '@/types/desktop'

import type { IpcRegistry } from '../ipc/IpcRegistry'
import type { DesktopConfigService } from '../services/DesktopConfigService'
import type { DesktopApprovalHandler } from '../services/PermissionService'
import type { DirectorySelectionService } from '../services/DirectorySelectionService'
import { assertNotSensitive } from '../security/PathPolicy'

const MAX_ENTRIES = 500
const MAX_TEXT_BYTES = 2 * 1024 * 1024
const MAX_MEDIA_BYTES = 10 * 1024 * 1024
const IMAGE_MIME_TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

function decodeText(buffer: Buffer): string | null {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return new TextDecoder('utf-16le').decode(buffer.subarray(2))
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return new TextDecoder('utf-16be').decode(buffer.subarray(2))
  if (buffer.includes(0)) return null
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return null
  }
}

const isInside = (target: string, root: string) => target === root || target.startsWith(`${root}${path.sep}`)

export class ProjectController {
  private readonly pendingProjectAccess = new Map<string, { promise: Promise<string> }>()

  constructor(
    private readonly config: DesktopConfigService,
    private readonly directorySelections: DirectorySelectionService,
    private readonly confirm: DesktopApprovalHandler = async () => false
  ) {}

  register(ipc: IpcRegistry) {
    ipc.register('project.list', () => this.config.listProjects())
    ipc.register('project.getDefault', () => this.config.getDefaultProject())
    ipc.register('project.setDefault', (id) => {
      if (id !== null && (typeof id !== 'string' || !id || id.length > 80)) throw new Error('项目标识无效')
      return this.config.setDefaultProject(id)
    })
    ipc.register('project.create', (input) => this.createProject(input))
    ipc.register('project.delete', async (id) => {
      if (!id || typeof id !== 'string' || id.length > 80) throw new Error('项目标识无效')
      await this.config.deleteProject(id)
    })
    ipc.register('project.listEntries', (input) => this.listEntries(input))
    ipc.register('project.readFile', (input) => this.readFile(input))
  }

  async createProject(input: unknown) {
    if (!input || typeof input !== 'object') throw new Error('项目参数无效')
    const projectInput = input as { name?: unknown; rootPath?: unknown }
    const name = typeof projectInput.name === 'string' ? projectInput.name.trim() : ''
    const rootPath = typeof projectInput.rootPath === 'string' ? projectInput.rootPath.trim() : ''
    if (!name || !rootPath || !path.isAbsolute(rootPath)) throw new Error('项目名称或源文件夹无效')

    const absolute = path.resolve(rootPath)
    const resolved = await fs.realpath(absolute).catch(() => absolute)
    if (!(await fs.stat(resolved)).isDirectory()) throw new Error('源文件夹必须是目录')
    assertNotSensitive(resolved)
    if (!this.directorySelections.consume(resolved)) throw new Error('请先通过目录选择器选择源文件夹')
    return this.config.createProject({ accessConfirmed: true, name, rootPath: resolved })
  }

  private async resolveProjectPath(input: { projectId: string; relativePath?: string }) {
    if (!input || typeof input !== 'object') throw new Error('项目参数无效')
    const projectId = typeof input.projectId === 'string' ? input.projectId.trim() : ''
    if (!projectId || projectId.length > 80) throw new Error('项目标识无效')

    const project = (await this.config.listProjects()).find((item) => item.id === projectId)
    if (!project) throw new Error('项目不存在')

    const root = await this.resolveProjectRoot(project)

    const relativePath = typeof input.relativePath === 'string' ? input.relativePath : ''
    const candidate = relativePath ? path.resolve(root, relativePath) : root
    const resolved = await fs.realpath(candidate).catch(() => candidate)
    assertNotSensitive(resolved)
    if (!isInside(resolved, root)) throw new Error('路径不在项目目录内')

    return resolved
  }

  private async resolveProjectRoot(project: Awaited<ReturnType<DesktopConfigService['listProjects']>>[number]) {
    const root = await fs.realpath(path.resolve(project.rootPath)).catch(() => path.resolve(project.rootPath))
    assertNotSensitive(root)
    if (project.accessConfirmed) return root

    const pending = this.pendingProjectAccess.get(project.id)?.promise
    if (pending) return pending

    const confirmation = (async () => {
      const currentProject = (await this.config.listProjects()).find((item) => item.id === project.id)
      if (!currentProject) throw new Error('项目不存在')

      const currentRoot = await fs
        .realpath(path.resolve(currentProject.rootPath))
        .catch(() => path.resolve(currentProject.rootPath))
      assertNotSensitive(currentRoot)
      if (currentProject.accessConfirmed) return currentRoot

      const confirmed = await this.confirm({
        detail: `工作目录：${JSON.stringify(currentRoot)}\n此目录来自旧版配置，请仅在确认路径可信时允许访问。`,
        message: '允许 PureChat 读取此前添加的本地工作目录？',
        title: '确认本地工作目录',
      })
      if (!confirmed) throw new Error('本地工作目录未获主进程确认')
      await this.config.confirmProjectAccess(project.id, currentRoot)
      return currentRoot
    })()

    const pendingAccess = { promise: confirmation }
    this.pendingProjectAccess.set(project.id, pendingAccess)
    pendingAccess.promise = confirmation.finally(() => {
      if (this.pendingProjectAccess.get(project.id) === pendingAccess) this.pendingProjectAccess.delete(project.id)
    })
    return pendingAccess.promise
  }

  async listEntries(input: { projectId: string; relativePath?: string }): Promise<DesktopProjectEntries> {
    const resolved = await this.resolveProjectPath(input)

    const stat = await fs.stat(resolved)
    if (!stat.isDirectory()) throw new Error('目标路径不是目录')

    const entries = (await fs.readdir(resolved, { withFileTypes: true }))
      .filter((entry) => entry.name !== '.git')
      .slice(0, MAX_ENTRIES)
      .map((entry) => ({ isDirectory: entry.isDirectory(), name: entry.name }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name, 'zh-CN')
      })

    return { entries, path: resolved }
  }

  async readFile(input: { projectId: string; relativePath: string }): Promise<DesktopProjectFile> {
    if (typeof input?.relativePath !== 'string' || !input.relativePath) throw new Error('文件路径无效')
    const resolved = await this.resolveProjectPath(input)
    const file = await fs.open(resolved, 'r')
    try {
      const stat = await file.stat()
      if (!stat.isFile()) throw new Error('目标路径不是文件')
      const meta = { name: path.basename(resolved), path: resolved, size: stat.size }
      const extension = path.extname(resolved).toLowerCase()
      const imageMime = IMAGE_MIME_TYPES[extension]
      if (extension === '.pdf') {
        return { ...meta, kind: 'unsupported', reason: '此文件类型暂不支持内容预览' }
      }
      const limit = imageMime ? MAX_MEDIA_BYTES : MAX_TEXT_BYTES
      if (stat.size > limit) {
        return { ...meta, kind: 'unsupported', reason: `文件超过 ${limit / 1024 / 1024} MB，暂不支持预览` }
      }

      // 限制实际读取量，避免文件在预览期间增长导致读取超出上限。
      const buffer = Buffer.alloc(Math.min(stat.size, limit) + 1)
      const { bytesRead } = await file.read(buffer, 0, buffer.length, 0)
      const content = buffer.subarray(0, bytesRead)
      if (bytesRead > limit) {
        return { ...meta, kind: 'unsupported', reason: '文件过大，暂不支持预览' }
      }
      if (imageMime) {
        return { ...meta, kind: 'image', dataUrl: `data:${imageMime};base64,${content.toString('base64')}` }
      }
      const text = decodeText(content)
      if (text === null) return { ...meta, kind: 'unsupported', reason: '此文件类型暂不支持内容预览' }
      return { ...meta, kind: 'text', content: text }
    } finally {
      await file.close()
    }
  }
}
