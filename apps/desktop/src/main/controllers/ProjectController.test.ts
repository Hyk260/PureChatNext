import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { DesktopConfigService } from '../services/DesktopConfigService'
import { DirectorySelectionService } from '../services/DirectorySelectionService'
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
    await writeFile(path.join(rootPath, '.editorconfig'), 'root = true')
    await writeFile(path.join(rootPath, 'src', 'index.ts'), 'export {}')

    const config = new DesktopConfigService(dir)
    const project = await config.createProject({ accessConfirmed: true, name: 'Demo', rootPath })
    const controller = new ProjectController(config, new DirectorySelectionService())

    const rootEntries = await controller.listEntries({ projectId: project.id })
    expect(rootEntries.entries.map((entry) => entry.name)).toEqual(['src', '.editorconfig', 'README.md'])

    const nested = await controller.listEntries({ projectId: project.id, relativePath: 'src' })
    expect(nested.entries.map((entry) => entry.name)).toEqual(['index.ts'])

    await expect(controller.listEntries({ projectId: project.id, relativePath: '..' })).rejects.toThrow(
      '路径不在项目目录内'
    )
  })
})

describe('ProjectController.readFile', () => {
  const createWorkspace = async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-preview-'))
    tempDirs.push(dir)
    const rootPath = path.join(dir, 'workspace')
    await mkdir(rootPath)
    const config = new DesktopConfigService(dir)
    const project = await config.createProject({ accessConfirmed: true, name: 'Preview', rootPath })
    return { controller: new ProjectController(config, new DirectorySelectionService()), dir, project, rootPath }
  }

  it('reads source files, empty files, and UTF-16 text without changing their content', async () => {
    const { controller, project, rootPath } = await createWorkspace()
    const source = 'export const hello = "你好"\n'
    await writeFile(path.join(rootPath, 'index.ts'), source)
    await writeFile(path.join(rootPath, 'empty.txt'), '')
    await writeFile(
      path.join(rootPath, 'unicode.txt'),
      Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(source, 'utf16le')])
    )
    for (const relativePath of ['index.ts', 'unicode.txt']) {
      expect(await controller.readFile({ projectId: project.id, relativePath })).toMatchObject({
        kind: 'text',
        content: source,
      })
    }
    expect(await controller.readFile({ projectId: project.id, relativePath: 'empty.txt' })).toMatchObject({
      kind: 'text',
      content: '',
    })
  })

  it('returns bounded image previews and a fallback for documents, binary or oversized files', async () => {
    const { controller, project, rootPath } = await createWorkspace()
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',
      'base64'
    )
    await writeFile(path.join(rootPath, 'image.png'), png)
    await writeFile(path.join(rootPath, 'sample.pdf'), '%PDF-1.4\n%%EOF')
    await writeFile(path.join(rootPath, 'binary.bin'), Buffer.from([0, 0xff, 0x42]))
    await writeFile(path.join(rootPath, 'large.txt'), Buffer.alloc(2 * 1024 * 1024 + 1, 'a'))
    expect(await controller.readFile({ projectId: project.id, relativePath: 'image.png' })).toMatchObject({
      kind: 'image',
      dataUrl: `data:image/png;base64,${png.toString('base64')}`,
    })
    for (const relativePath of ['sample.pdf', 'binary.bin', 'large.txt']) {
      expect(await controller.readFile({ projectId: project.id, relativePath })).toMatchObject({ kind: 'unsupported' })
    }
  })

  it('rejects traversal, escaping symlinks, directories, missing files, and unknown projects', async () => {
    const { controller, dir, project, rootPath } = await createWorkspace()
    await writeFile(path.join(dir, 'outside.txt'), 'outside')
    await symlink(path.join(dir, 'outside.txt'), path.join(rootPath, 'link.txt'))
    for (const relativePath of ['../outside.txt', 'link.txt']) {
      await expect(controller.readFile({ projectId: project.id, relativePath })).rejects.toThrow('路径不在项目目录内')
    }
    await expect(controller.readFile({ projectId: project.id, relativePath: '.' })).rejects.toThrow('目标路径不是文件')
    await expect(controller.readFile({ projectId: project.id, relativePath: 'missing.txt' })).rejects.toThrow()
    await expect(controller.readFile({ projectId: 'unknown', relativePath: 'file.txt' })).rejects.toThrow('项目不存在')
  })
})

describe('ProjectController.createProject', () => {
  it('requires and consumes a native directory selection before adding a project', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-project-create-'))
    tempDirs.push(dir)
    const rootPath = path.join(dir, 'workspace')
    await mkdir(rootPath)
    const config = new DesktopConfigService(dir)
    const selections = new DirectorySelectionService()
    const controller = new ProjectController(config, selections)

    await expect(controller.createProject({ name: 'Demo', rootPath })).rejects.toThrow('请先通过目录选择器')
    const canonicalRoot = await realpath(rootPath)
    selections.record(canonicalRoot)
    await expect(controller.createProject({ name: 'Demo', rootPath })).resolves.toMatchObject({
      name: 'Demo',
      rootPath: canonicalRoot,
    })
    await expect(controller.createProject({ name: 'Replay', rootPath })).rejects.toThrow('请先通过目录选择器')
  })

  it('requires main-process confirmation for projects persisted by an older version', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-project-legacy-'))
    tempDirs.push(dir)
    const rootPath = path.join(dir, 'workspace')
    await mkdir(rootPath)
    const config = new DesktopConfigService(dir)
    const project = await config.createProject({ name: 'Legacy', rootPath })
    const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const controller = new ProjectController(config, new DirectorySelectionService(), confirm)

    await expect(controller.listEntries({ projectId: project.id })).rejects.toThrow('未获主进程确认')
    await expect(controller.listEntries({ projectId: project.id })).resolves.toMatchObject({ path: await realpath(rootPath) })
    expect(confirm).toHaveBeenCalledTimes(2)
    expect((await config.listProjects())[0].accessConfirmed).toBe(true)
  })

  it('shares one confirmation across concurrent requests for the same legacy project', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'purechat-project-confirm-once-'))
    tempDirs.push(dir)
    const rootPath = path.join(dir, 'workspace')
    await mkdir(rootPath)
    await writeFile(path.join(rootPath, 'README.md'), 'hello')

    const config = new DesktopConfigService(dir)
    const project = await config.createProject({ name: 'Legacy', rootPath })
    const readProjects = config.listProjects.bind(config)
    let releaseInitialReads!: () => void
    const initialReads = new Promise<void>((resolve) => {
      releaseInitialReads = resolve
    })
    let initialReadCount = 0
    vi.spyOn(config, 'listProjects').mockImplementation(async () => {
      const projects = await readProjects()
      initialReadCount += 1
      if (initialReadCount <= 2) {
        if (initialReadCount === 2) releaseInitialReads()
        await initialReads
      }
      return projects
    })

    let allowAccess!: (allowed: boolean) => void
    const approval = new Promise<boolean>((resolve) => {
      allowAccess = resolve
    })
    const confirm = vi.fn(() => approval)
    const controller = new ProjectController(config, new DirectorySelectionService(), confirm)

    const requests = Promise.all([
      controller.listEntries({ projectId: project.id }),
      controller.readFile({ projectId: project.id, relativePath: 'README.md' }),
    ])
    await vi.waitFor(() => expect(confirm).toHaveBeenCalled())
    allowAccess(true)

    const [entries, preview] = await requests
    expect(entries.path).toBe(await realpath(rootPath))
    expect(preview).toMatchObject({ kind: 'text', content: 'hello' })
    expect(confirm).toHaveBeenCalledTimes(1)
  })
})
