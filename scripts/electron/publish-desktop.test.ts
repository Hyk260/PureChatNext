// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const script = fileURLToPath(new URL('./publish-desktop.mts', import.meta.url))

describe('desktop upload CLI', () => {
  it('prints help and rejects local storage with shell variables taking priority over an explicit env file', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'purechat-publish-cli-'))
    const envFile = path.join(directory, '.env')
    writeFileSync(envFile, 'S3_ENDPOINT=https://cos.ap-shanghai.myqcloud.com\n')
    const env = {
      ...process.env,
      S3_ACCESS_KEY_ID: 'fake-id',
      S3_SECRET_ACCESS_KEY: 'secret-must-not-print',
      S3_BUCKET: 'test-123',
      S3_REGION: 'ap-shanghai',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ENABLE_PATH_STYLE: '0',
      PURECHAT_DESKTOP_UPDATE_URL: '',
    }
    try {
      const help = spawnSync(process.execPath, ['--import', 'tsx', script, '--help'], { env, encoding: 'utf8' })
      expect(help.status).toBe(0)
      expect(help.stdout).toContain('--dry-run')
      const result = spawnSync(process.execPath, ['--import', 'tsx', script, '--env-file', envFile, '--dry-run'], {
        env,
        encoding: 'utf8',
      })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('COS 地域 Endpoint')
      expect(result.stdout + result.stderr).not.toContain(env.S3_SECRET_ACCESS_KEY)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
