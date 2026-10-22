import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { DesktopProjectEntries, DesktopProjectFile } from '@/types/desktop'

import type { IpcRegistry } from '../ipc/IpcRegistry'
import type { DesktopConfigService } from '../services/DesktopConfigService'
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
  constructor(private readonly config: DesktopConfigService) {}

  register(ipc: IpcRegistry) {
    ipc.register('project.list', () => this.config.listProjects())
    ipc.register('project.create', async (input) => {
      if (!input || typeof input !== 'object') throw new Error('项目参数无效')
      const name = typeof input.name === 'string' ? input.name.trim() : ''
      const rootPath = typeof input.rootPath === 'string' ? input.rootPath.trim() : ''
      if (!name || !rootPath || !path.isAbsolute(rootPath)) throw new Error('项目名称或源文件夹无效')

      const absolute = path.resolve(rootPath)
      const resolved = await fs.realpath(absolute).catch(() => absolute)
      if (!(await fs.stat(resolved)).isDirectory()) throw new Error('源文件夹必须是目录')
      assertNotSensitive(resolved)
      return this.config.createProject({ name, rootPath: resolved })
    })
    ipc.register('project.delete', async (id) => {
      if (!id || typeof id !== 'string' || id.length > 80) throw new Error('项目标识无效')
      await this.config.deleteProject(id)
    })
    ipc.register('project.listEntries', (input) => this.listEntries(input))
    ipc.register('project.readFile', (input) => this.readFile(input))
  }

  private async resolveProjectPath(input: { projectId: string; relativePath?: string }) {
    if (!input || typeof input !== 'object') throw new Error('项目参数无效')
    const projectId = typeof input.projectId === 'string' ? input.projectId.trim() : ''
    if (!projectId || projectId.length > 80) throw new Error('项目标识无效')

    const project = (await this.config.listProjects()).find((item) => item.id === projectId)
    if (!project) throw new Error('项目不存在')

    const root = await fs.realpath(path.resolve(project.rootPath)).catch(() => path.resolve(project.rootPath))
    assertNotSensitive(root)

    const relativePath = typeof input.relativePath === 'string' ? input.relativePath : ''
    const candidate = relativePath ? path.resolve(root, relativePath) : root
    const resolved = await fs.realpath(candidate).catch(() => candidate)
    assertNotSensitive(resolved)
    if (!isInside(resolved, root)) throw new Error('路径不在项目目录内')

    return resolved
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
