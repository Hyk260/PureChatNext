import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { DesktopProjectEntries } from '../../../../../src/types/desktop'

import type { IpcRegistry } from '../ipc/IpcRegistry'
import type { DesktopConfigService } from '../services/DesktopConfigService'
import { assertNotSensitive } from '../security/PathPolicy'

const MAX_ENTRIES = 500

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
  }

  async listEntries(input: { projectId: string; relativePath?: string }): Promise<DesktopProjectEntries> {
    if (!input || typeof input !== 'object') throw new Error('项目参数无效')
    const projectId = typeof input.projectId === 'string' ? input.projectId.trim() : ''
    if (!projectId || projectId.length > 80) throw new Error('项目标识无效')

    const project = (await this.config.listProjects()).find((item) => item.id === projectId)
    if (!project) throw new Error('项目不存在')

    const root = await fs.realpath(path.resolve(project.rootPath)).catch(() => path.resolve(project.rootPath))
    assertNotSensitive(root)

    const relativePath = typeof input.relativePath === 'string' ? input.relativePath.trim() : ''
    const candidate = relativePath ? path.resolve(root, relativePath) : root
    const resolved = await fs.realpath(candidate).catch(() => candidate)
    assertNotSensitive(resolved)
    if (!isInside(resolved, root)) throw new Error('路径不在项目目录内')

    const stat = await fs.stat(resolved)
    if (!stat.isDirectory()) throw new Error('目标路径不是目录')

    const entries = (await fs.readdir(resolved, { withFileTypes: true }))
      .filter((entry) => !entry.name.startsWith('.'))
      .slice(0, MAX_ENTRIES)
      .map((entry) => ({ isDirectory: entry.isDirectory(), name: entry.name }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name, 'zh-CN')
      })

    return { entries, path: resolved }
  }
}
