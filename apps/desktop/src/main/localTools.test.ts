import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { executeLocalTool } from './localTools'

const tempDirs: string[] = []
const config = (scope: string) => ({ permissionScopes: { topic: [scope] }, remoteServerUrl: null, secrets: {} })

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })))
})

describe('desktop local tools', () => {
  it('enforces topic scope and caches repeated calls', async () => {
    const scope = await mkdtemp(path.join(os.tmpdir(), 'purechat-local-'))
    tempDirs.push(scope)
    const grants = new Set<string>()
    const request = {
      approved: true,
      args: { content: 'hello', path: 'note.txt' },
      mode: 'auto' as const,
      toolCallId: 'call-1',
      toolName: 'writeFile' as const,
      topicId: 'topic',
    }
    const denied = await executeLocalTool(
      { ...request, args: { ...request.args, path: '../outside.txt' } },
      config(scope),
      grants
    )
    expect(denied.success).toBe(false)
    const first = await executeLocalTool(request, config(scope), grants)
    expect(first.success, first.content).toBe(true)
    const second = await executeLocalTool(request, config(scope), grants)
    expect(first).toEqual(second)
    expect(await readFile(path.join(scope, 'note.txt'), 'utf8')).toBe('hello')
  })

  it('requires approval for commands and rejects dangerous commands', async () => {
    const scope = await mkdtemp(path.join(os.tmpdir(), 'purechat-local-'))
    tempDirs.push(scope)
    const grants = new Set<string>()
    const base = { mode: 'ask' as const, toolCallId: 'call-2', toolName: 'runCommand' as const, topicId: 'topic' }
    expect((await executeLocalTool({ ...base, args: { command: 'echo ok' } }, config(scope), grants)).success).toBe(
      false
    )
    expect(
      (await executeLocalTool({ ...base, approved: true, args: { command: 'sudo rm -rf /' } }, config(scope), grants))
        .success
    ).toBe(false)
  })
})
