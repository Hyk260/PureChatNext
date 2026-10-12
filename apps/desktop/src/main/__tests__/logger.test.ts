// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import log from 'electron-log'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ root: '', packaged: true }))
vi.mock('electron', () => ({
  app: {
    getPath: () => mocks.root,
    get isPackaged() {
      return mocks.packaged
    },
  },
}))

import { createLogger, getLogDirectory, redactLogText } from '../logger'

beforeEach(async () => {
  mocks.root = await mkdtemp(path.join(tmpdir(), 'purechat-log-'))
  mocks.packaged = true
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 12, 14, 5, 6))
})

afterEach(async () => {
  vi.useRealTimers()
  await rm(mocks.root, { recursive: true, force: true })
})

describe('desktop logging', () => {
  it('writes local timestamps, levels, scopes and error details into daily production logs', async () => {
    const logger = createLogger('desktop:update')
    expect(log.transports.console.format).toBe(log.transports.file.format)
    expect(log.transports.file.maxSize).toBe(10 * 1024 * 1024)
    log.transports.console.level = false
    const error = Object.assign(
      new Error('Download failed https://user:password@updates.test/update.zip?token=secret#fragment'),
      { code: 'ERR_UPDATER' }
    )
    logger.error('Failure during downloading', error)
    const file = path.join(getLogDirectory(), '2026-10-12.log')
    const text = await readFile(file, 'utf8')
    expect(text).toContain('2026-10-12 14:05:06 [error] (desktop:update) Failure during downloading')
    expect(text).toContain('ERR_UPDATER')
    expect(text).toContain('Error: Download failed')
    expect(text).toContain('https://updates.test/update.zip')
    expect(text).not.toMatch(/password|token=secret|fragment/)
  })

  it('keeps development logs separate and redacts updater URL messages', async () => {
    mocks.packaged = false
    const logger = createLogger('desktop:update')
    log.transports.console.level = false
    logger.info('Downloading https://user:password@updates.test/update.zip?token=secret')
    expect(getLogDirectory()).toBe(path.join(mocks.root, 'log', 'dev'))
    const text = await readFile(path.join(getLogDirectory(), '2026-10-12.log'), 'utf8')
    expect(text).toContain('(desktop:update) Downloading https://updates.test/update.zip')
    expect(text).not.toContain('secret')
    expect(redactLogText('https://updates.test/latest.yml?noCache=1')).toBe('https://updates.test/latest.yml')
    expect(redactLogText('(address=http://127.0.0.1:5510, file=https://updates.test/update.zip?token=secret)')).toBe(
      '(address=http://127.0.0.1:5510/, file=https://updates.test/update.zip)'
    )
    expect(redactLogText('http://[::1]:5510,')).toBe('http://[::1]:5510/,')
    expect(redactLogText('Cannot parse (https://updates.test/latest.yml?noCache=secret): invalid YAML')).toBe(
      'Cannot parse (https://updates.test/latest.yml): invalid YAML'
    )
  })
})
