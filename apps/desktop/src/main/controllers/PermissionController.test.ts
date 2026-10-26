import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { DesktopConfigService } from '../services/DesktopConfigService'
import { PermissionService } from '../services/PermissionService'
import { PermissionController } from './PermissionController'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })))
})

describe('PermissionController.setScope', () => {
  it('only stores a configured project root as the topic scope', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-permission-scope-'))
    tempDirs.push(dir)
    const rootPath = path.join(dir, 'workspace')
    const otherPath = path.join(dir, 'other')
    await mkdir(rootPath)
    await mkdir(otherPath)
    const config = new DesktopConfigService(dir)
    const project = await config.createProject({ name: 'Demo', rootPath })
    const controller = new PermissionController(config, new PermissionService())

    await expect(controller.setScope('topic-1', otherPath)).rejects.toThrow('已添加的项目目录')
    await expect(controller.setScope('topic-1', rootPath)).rejects.toThrow('已添加的项目目录')
    await config.confirmProjectAccess(project.id, await realpath(rootPath))
    await expect(controller.setScope('topic-1', rootPath)).resolves.toEqual({ scope: await realpath(rootPath) })
    await expect(controller.setScope('topic-1', null)).resolves.toEqual({ scope: null })
  })
})
