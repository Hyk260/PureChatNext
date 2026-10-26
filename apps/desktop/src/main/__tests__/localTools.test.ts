import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { CommandService } from '../services/CommandService'
import { DesktopConfigService } from '../services/DesktopConfigService'
import { LocalToolService } from '../services/LocalToolService'
import { PermissionService } from '../services/PermissionService'

const tempDirs: string[] = []
const createTools = async (
  scope: string,
  confirm: (prompt: { detail: string; message: string; title: string }) => Promise<boolean> = async () => false
) => {
  const config = new DesktopConfigService(scope)
  await config.write({
    permissionScopes: { topic: [scope] },
    projects: [
      { accessConfirmed: true, createdAt: Date.now(), id: 'project-1', name: 'Workspace', rootPath: scope },
    ],
    remoteServerUrl: null,
    secrets: {},
  })
  const permissions = new PermissionService(confirm)
  return new LocalToolService(config, permissions, new CommandService(permissions))
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })))
})

describe('desktop local tools', () => {
  it('enforces topic scope and caches repeated calls', async () => {
    const scope = await mkdtemp(path.join(os.tmpdir(), 'purechat-local-'))
    tempDirs.push(scope)
    const tools = await createTools(scope, async () => true)
    const request = {
      approved: true,
      args: { content: 'hello', path: 'note.txt' },
      mode: 'auto' as const,
      toolCallId: 'call-1',
      toolName: 'writeFile' as const,
      topicId: 'topic',
    }
    const denied = await tools.execute({ ...request, args: { ...request.args, path: '../outside.txt' } })
    expect(denied.success).toBe(false)
    const first = await tools.execute(request)
    expect(first.success, first.content).toBe(true)
    const second = await tools.execute(request)
    expect(first).toEqual(second)
    expect(await readFile(path.join(scope, 'note.txt'), 'utf8')).toBe('hello')
  })

  it('requires approval for commands and rejects dangerous commands', async () => {
    const scope = await mkdtemp(path.join(os.tmpdir(), 'purechat-local-'))
    tempDirs.push(scope)
    const tools = await createTools(scope)
    const base = { mode: 'ask' as const, toolCallId: 'call-2', toolName: 'runCommand' as const, topicId: 'topic' }
    expect((await tools.execute({ ...base, args: { command: 'echo ok' } })).success).toBe(false)
    expect((await tools.execute({ ...base, approved: true, args: { command: 'sudo rm -rf /' } })).success).toBe(false)
  })

  it('executes approved tools without a second confirmation and still requires a full-access grant', async () => {
    const scope = await mkdtemp(path.join(os.tmpdir(), 'purechat-local-'))
    tempDirs.push(scope)
    const confirm = vi.fn().mockResolvedValue(false)
    const tools = await createTools(scope, confirm)

    const write = await tools.execute({
      approved: true,
      args: { content: 'approved content', path: 'approved.txt' },
      mode: 'ask',
      toolCallId: 'approved-write',
      toolName: 'writeFile',
      topicId: 'topic',
    })
    const command = await tools.execute({
      approved: true,
      args: { command: 'echo approved' },
      mode: 'ask',
      toolCallId: 'approved-command',
      toolName: 'runCommand',
      topicId: 'topic',
    })
    const ungrantedFullMode = await tools.execute({
      approved: true,
      args: { command: 'echo should-not-run' },
      mode: 'full',
      toolCallId: 'forged-full-mode',
      toolName: 'runCommand',
      topicId: 'topic',
    })

    expect(write.success).toBe(true)
    expect(command.success).toBe(true)
    expect(await readFile(path.join(scope, 'approved.txt'), 'utf8')).toBe('approved content')
    expect(ungrantedFullMode.success).toBe(false)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('rejects legacy permission scopes until the project root is confirmed', async () => {
    const scope = await mkdtemp(path.join(os.tmpdir(), 'purechat-local-legacy-'))
    tempDirs.push(scope)
    const config = new DesktopConfigService(scope)
    await config.write({
      permissionScopes: { topic: [scope] },
      projects: [{ accessConfirmed: false, createdAt: Date.now(), id: 'legacy', name: 'Legacy', rootPath: scope }],
      remoteServerUrl: null,
      secrets: {},
    })
    const permissions = new PermissionService()
    const tools = new LocalToolService(config, permissions, new CommandService(permissions))

    const read = await tools.execute({
      args: { path: '.' },
      mode: 'ask',
      toolCallId: 'legacy-read',
      toolName: 'listFiles',
      topicId: 'topic',
    })

    expect(read.success).toBe(false)
    expect(read.content).toContain('工作目录尚未由用户确认')
  })
})
