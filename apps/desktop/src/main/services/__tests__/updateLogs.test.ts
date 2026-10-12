// @vitest-environment node
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: {} }))

import { readUpdateLogs } from '../updateLogs'

let root: string
const header = '2026-10-12 16:00:00'
beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), 'purechat-update-logs-')) })
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

describe('update log reader', () => {
  it('keeps update error stacks and filters unrelated records, with URL credentials redacted', async () => {
    await writeFile(path.join(root, '2026-10-12.log'), [
      `${header} [info] (desktop:startup) private application record`,
      '  unrelated continuation',
      `${header} [error] (desktop:update) Download failed https://user:password@updates.test/update.zip?token=secret`,
      '  code: ERR_SIGNATURE',
      '  stack: at updater.install()',
      `${header} [info] (desktop:window) window error mentioning (desktop:update)`,
      '  another private continuation',
      `${header} [info] unscoped private record`,
    ].join('\n'))
    const result = await readUpdateLogs(root)
    expect(result.text).toContain('ERR_SIGNATURE')
    expect(result.text).toContain('at updater.install()')
    expect(result.text).toContain('https://updates.test/update.zip')
    expect(result.text).not.toMatch(/private|unrelated|password|token=secret|window error/)
    expect(result.truncated).toBe(false)
  })

  it('orders rotated logs before the current log and ignores links and unrelated filenames', async () => {
    await writeFile(path.join(root, '2026-10-12.old.log'), `${header} [info] (desktop:update) previous run`)
    await writeFile(path.join(root, '2026-10-12.log'), `${header} [info] (desktop:update) current run`)
    await writeFile(path.join(root, 'private.log'), `${header} [info] (desktop:update) unrelated file`)
    await symlink('private.log', path.join(root, '2026-10-11.log'))
    const result = await readUpdateLogs(root)
    expect(result.text.indexOf('previous run')).toBeLessThan(result.text.indexOf('current run'))
    expect(result.text).not.toContain('unrelated file')
  })

  it('bounds file reads and response size while retaining the newest records', async () => {
    await writeFile(path.join(root, '2026-10-12.log'), 'x'.repeat(300 * 1024) + `\n${header} [error] (desktop:update) newest error\n  newest stack`)
    const result = await readUpdateLogs(root)
    expect(result.truncated).toBe(true)
    expect(result.text).toContain('newest error')
    expect(result.text).toContain('newest stack')
    expect(Buffer.byteLength(result.text)).toBeLessThanOrEqual(256 * 1024)
  })

  it('returns an empty result for a missing log directory', async () => {
    expect(await readUpdateLogs(path.join(root, 'missing'))).toEqual({ text: '', truncated: false })
  })
})
