import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { CommandService } from '../services/CommandService'
import { DesktopConfigService } from '../services/DesktopConfigService'
import { LocalToolService } from '../services/LocalToolService'
import { PermissionService } from '../services/PermissionService'

const tempDirs: string[] = []
const createTools = async (scope: string, confirm = false) => {
  const config = new DesktopConfigService(scope)
  await config.write({
    permissionScopes: { topic: [scope] },
    projects: [],
    remoteServerUrl: null,
    secrets: {},
  })
  const permissions = new PermissionService(async () => confirm)
  return new LocalToolService(config, permissions, new CommandService(permissions))
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })))
})

describe('desktop local tools', () => {
  it('enforces topic scope and caches repeated calls', async () => {
    const scope = await mkdtemp(path.join(os.tmpdir(), 'purechat-local-'))
    tempDirs.push(scope)
    const tools = await createTools(scope, true)
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
})
