import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { DesktopConfigService } from '../services/DesktopConfigService'
import { ProjectController } from './ProjectController'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })))
})

describe('ProjectController.listEntries', () => {
  it('lists project files and blocks path escape', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-project-'))
    tempDirs.push(dir)
    const rootPath = path.join(dir, 'workspace')
    await mkdir(rootPath)
    await mkdir(path.join(rootPath, 'src'))
    await writeFile(path.join(rootPath, 'README.md'), 'hello')
    await writeFile(path.join(rootPath, 'src', 'index.ts'), 'export {}')

    const config = new DesktopConfigService(dir)
    const project = await config.createProject({ name: 'Demo', rootPath })
    const controller = new ProjectController(config)

    const rootEntries = await controller.listEntries({ projectId: project.id })
    expect(rootEntries.entries.map((entry) => entry.name)).toEqual(['src', 'README.md'])

    const nested = await controller.listEntries({ projectId: project.id, relativePath: 'src' })
    expect(nested.entries.map((entry) => entry.name)).toEqual(['index.ts'])

    await expect(controller.listEntries({ projectId: project.id, relativePath: '..' })).rejects.toThrow(
      '路径不在项目目录内'
    )
  })
})
