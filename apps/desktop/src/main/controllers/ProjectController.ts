import { execFile, spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { DesktopProjectEntries, DesktopProjectFile, DesktopProjectGitChange } from '@/types/desktop'

import type { IpcRegistry } from '../ipc/IpcRegistry'
import type { DesktopConfigService } from '../services/DesktopConfigService'
import type { DesktopApprovalHandler } from '../services/PermissionService'
import type { DirectorySelectionService } from '../services/DirectorySelectionService'
import { assertNotSensitive } from '../security/PathPolicy'

const MAX_ENTRIES = 500
const GIT_COMMAND_TIMEOUT_MS = 5_000
const GIT_MAX_BUFFER_BYTES = 5 * 1024 * 1024
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
const toGitPath = (value: string) => value.split(path.sep).join('/')

const runGitCommand = (cwd: string, args: string[]) =>
  new Promise<string>((resolve, reject) => {
    execFile(
      'git',
      args,
      {
        cwd,
        encoding: 'utf8',
        maxBuffer: GIT_MAX_BUFFER_BYTES,
        timeout: GIT_COMMAND_TIMEOUT_MS,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) reject(error)
        else resolve(stdout)
      }
    )
  })

const findGitRoot = async (directory: string) => {
  try {
    const output = await runGitCommand(directory, ['rev-parse', '--show-toplevel'])
    return path.resolve(output.trim())
  } catch {
    return null
  }
}

const getGitChangeStatus = (status: string): DesktopProjectGitChange['status'] => {
  if (status === '??') return '?'
  if (status.includes('U')) return 'U'
  if (status.includes('D')) return 'D'
  if (status.includes('A')) return 'A'
  if (status.includes('R')) return 'R'
  if (status.includes('C')) return 'C'
  if (status.includes('T')) return 'T'
  return 'M'
}

const getProjectGitChanges = async (projectRoot: string, gitRoot: string): Promise<DesktopProjectGitChange[]> => {
  const projectRelativePath = toGitPath(path.relative(gitRoot, projectRoot))
  const projectPathspec = projectRelativePath ? `:(top,literal)${projectRelativePath}` : '.'
  const output = await runGitCommand(gitRoot, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
    '--',
    projectPathspec,
  ])
  const records = output.split('\0')
  const projectPrefix = projectRelativePath || '.'
  const changes: DesktopProjectGitChange[] = []

  for (let index = 0; index < records.length; index++) {
    const record = records[index]
    if (!record) continue

    const status = record.slice(0, 2)
    const gitPath = toGitPath(record.slice(3))
    const relativePath = projectPrefix === '.' ? gitPath : path.posix.relative(projectPrefix, gitPath)
    if (!relativePath || relativePath === '..' || relativePath.startsWith('../')) continue

    changes.push({ path: relativePath, status: getGitChangeStatus(status) })
    if (status.includes('R') || status.includes('C')) index++
  }

  return changes
}

const findIgnoredPaths = (gitRoot: string, paths: string[]) =>
  new Promise<Set<string>>((resolve) => {
    if (paths.length === 0) {
      resolve(new Set())
      return
    }

    const child = spawn('git', ['check-ignore', '-z', '--stdin'], {
      cwd: gitRoot,
      stdio: ['pipe', 'pipe', 'ignore'],
      windowsHide: true,
    })
    const output: Buffer[] = []
    let settled = false
    const timer = setTimeout(() => {
      child.kill()
      finish(new Set())
    }, GIT_COMMAND_TIMEOUT_MS)

    const finish = (ignored: Set<string>) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(ignored)
    }

    child.stdout.on('data', (chunk: Buffer) => output.push(Buffer.from(chunk)))
    child.on('error', () => finish(new Set()))
    child.on('close', (code) => {
      if (code !== 0 && code !== 1) {
        finish(new Set())
        return
      }
      finish(new Set(Buffer.concat(output).toString('utf8').split('\0').filter(Boolean)))
    })
    child.stdin.on('error', () => finish(new Set()))
    child.stdin.end(`${paths.join('\0')}\0`)
  })

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

  private async resolveProjectContext(input: { projectId: string; relativePath?: string }) {
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

    return { path: resolved, projectRoot: root }
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
    const { path: resolved, projectRoot } = await this.resolveProjectContext(input)

    const stat = await fs.stat(resolved)
    if (!stat.isDirectory()) throw new Error('目标路径不是目录')

    const directoryEntries = (await fs.readdir(resolved, { withFileTypes: true }))
      .filter((entry) => entry.name !== '.git')
      .slice(0, MAX_ENTRIES)
      .map((entry) => ({ isDirectory: entry.isDirectory(), name: entry.name }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name, 'zh-CN')
      })

    const gitRoot = await findGitRoot(projectRoot)
    let entries = directoryEntries
    let gitChanges: DesktopProjectGitChange[] = []
    if (gitRoot) {
      const gitPaths = directoryEntries.map((entry) => toGitPath(path.relative(gitRoot, path.join(resolved, entry.name))))
      const ignoredPaths = await findIgnoredPaths(gitRoot, gitPaths)
      entries = directoryEntries.map((entry, index) =>
        ignoredPaths.has(gitPaths[index]) ? { ...entry, gitIgnored: true } : entry
      )

      if (!input.relativePath) {
        try {
          gitChanges = await getProjectGitChanges(projectRoot, gitRoot)
        } catch {
          gitChanges = []
        }
      }
    }

    return { entries, gitChanges, isGitRepository: Boolean(gitRoot), path: resolved }
  }

  async readFile(input: { projectId: string; relativePath: string }): Promise<DesktopProjectFile> {
    if (typeof input?.relativePath !== 'string' || !input.relativePath) throw new Error('文件路径无效')
    const { path: resolved } = await this.resolveProjectContext(input)
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
