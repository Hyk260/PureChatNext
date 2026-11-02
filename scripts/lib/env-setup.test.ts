// @vitest-environment node
import { mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { parse } from 'dotenv'
import { importJWK, jwtVerify, SignJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { setupEnvironment } from './env-setup'

const SECRET_KEYS = ['AUTH_SECRET', 'KEY_VAULTS_SECRET', 'TOOL_APPROVAL_SECRET', 'CRON_SECRET', 'JWKS_KEY']
const TEMPLATE = `# template\nAPP_URL=http://localhost:5174\n# AUTH_SECRET=\n# KEY_VAULTS_SECRET=\n# TOOL_APPROVAL_SECRET=\n# CRON_SECRET=\n# JWKS_KEY='{"keys":[...]}'\n# DATABASE_URL=postgres://example\n`

describe('environment setup', () => {
  let root: string
  const setup = (file = '.env', environment: Partial<NodeJS.ProcessEnv> = {}) =>
    setupEnvironment({ root, file, environment })
  const readEnv = async (file = '.env') => parse(await readFile(path.join(root, file), 'utf8'))

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'purechat-env-setup-'))
    await writeFile(path.join(root, '.env.example'), TEMPLATE)
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('creates independent persistent secrets and a working RSA JWT signing key', async () => {
    const result = await setup()
    const values = await readEnv()
    expect(result.created).toBe(true)
    expect(result.generated).toEqual(SECRET_KEYS)
    expect(result.missing).toEqual(['DATABASE_URL'])
    expect(values.APP_URL).toBe('http://localhost:5174')
    expect(values.DATABASE_DRIVER).toBe('neon')
    expect(values.DATABASE_URL).toBe('')
    for (const name of SECRET_KEYS.slice(0, -1)) expect(Buffer.from(values[name], 'base64url')).toHaveLength(32)
    expect(new Set(SECRET_KEYS.map((name) => values[name])).size).toBe(SECRET_KEYS.length)
    const {
      keys: [jwk],
    } = JSON.parse(values.JWKS_KEY)
    expect(jwk).toMatchObject({ kty: 'RSA', alg: 'RS256', use: 'sig', d: expect.any(String), kid: expect.any(String) })
    const privateKey = await importJWK(jwk, 'RS256')
    const publicKey = await importJWK({ kty: jwk.kty, n: jwk.n, e: jwk.e, alg: jwk.alg }, 'RS256')
    const jwt = await new SignJWT({ sub: 'test-user' }).setProtectedHeader({ alg: 'RS256' }).sign(privateKey)
    expect((await jwtVerify(jwt, publicKey)).payload.sub).toBe('test-user')
    if (process.platform !== 'win32') expect((await stat(result.filePath)).mode & 0o777).toBe(0o600)
    expect(await readdir(root)).toEqual(expect.arrayContaining(['.env', '.env.example']))
    expect((await readdir(root)).some((name) => name.endsWith('.lock') || name.endsWith('.tmp'))).toBe(false)
  })

  it('does not rotate keys or rewrite file contents on repeated runs', async () => {
    await setup()
    const first = await readFile(path.join(root, '.env'), 'utf8')
    const result = await setup()
    expect(await readFile(result.filePath, 'utf8')).toBe(first)
    expect(result.generated).toEqual([])
    expect(result.created).toBe(false)
  })

  it('fills blank assignments and keeps user values, multiline secrets, comments and unrelated settings', async () => {
    const original = `# keep this comment\r\nAUTH_SECRET='user-chosen-secret'\r\nexport KEY_VAULTS_SECRET="" # fill me\r\nTOOL_APPROVAL_SECRET='  '\r\nJWKS_KEY='{\n"keys": []\n}'\r\nCUSTOM_SETTING=keep\r\nDATABASE_URL=postgres://user:password@localhost/db\r\n`
    await writeFile(path.join(root, '.env'), original)
    const result = await setup()
    const values = await readEnv()
    expect(result.generated).toEqual(['KEY_VAULTS_SECRET', 'TOOL_APPROVAL_SECRET', 'CRON_SECRET'])
    expect(result.missing).toEqual([])
    expect(values.AUTH_SECRET).toBe('user-chosen-secret')
    expect(values.JWKS_KEY).toBe('{\n"keys": []\n}')
    expect(values.CUSTOM_SETTING).toBe('keep')
    expect(await readFile(result.filePath, 'utf8')).toContain('# keep this comment\r\n')
    expect((await readFile(result.filePath, 'utf8')).match(/^KEY_VAULTS_SECRET=/gm)).toHaveLength(1)
  })

  it('reuses shell and .env.local values without overwriting a configured target', async () => {
    await writeFile(
      path.join(root, '.env.local'),
      'KEY_VAULTS_SECRET=old-vault-key\nAUTH_SECRET=local-auth\nDATABASE_DRIVER=node\nDATABASE_URL=postgres://local/db\n'
    )
    await writeFile(path.join(root, '.env'), 'AUTH_SECRET=keep-target-auth\n')
    const result = await setup('.env', { AUTH_SECRET: 'shell-auth', CRON_SECRET: 'shell-cron' })
    const values = await readEnv()
    expect(values).toMatchObject({
      AUTH_SECRET: 'keep-target-auth',
      KEY_VAULTS_SECRET: 'old-vault-key',
      CRON_SECRET: 'shell-cron',
      DATABASE_DRIVER: 'node',
      DATABASE_URL: 'postgres://local/db',
    })
    expect(result.generated).not.toContain('KEY_VAULTS_SECRET')
    expect(JSON.stringify(result)).not.toContain('old-vault-key')
    expect(JSON.stringify(result)).not.toContain('shell-cron')
  })

  it('reuses environment-specific keys and can complete a .local file from root .env', async () => {
    await writeFile(path.join(root, '.env.production.local'), 'KEY_VAULTS_SECRET=production-vault\n')
    await writeFile(path.join(root, '.env'), 'KEY_VAULTS_SECRET=root-vault\n')
    await setup('.env.local')
    expect((await readEnv('.env.local')).KEY_VAULTS_SECRET).toBe('root-vault')
    await setup('.env.production.local')
    expect((await readEnv('.env.production.local')).KEY_VAULTS_SECRET).toBe('production-vault')
  })

  it('persists process values containing dollar signs and replaces template defaults without duplicates', async () => {
    const result = await setup('.env', { AUTH_SECRET: 'literal-$dollar-#hash', APP_URL: 'https://chat.example.com' })
    const contents = await readFile(result.filePath, 'utf8')
    expect((await readEnv()).AUTH_SECRET).toBe('literal-\\$dollar-#hash')
    expect((await readEnv()).APP_URL).toBe('https://chat.example.com')
    expect(contents.match(/^APP_URL=/gm)).toHaveLength(1)
    expect(JSON.stringify(result)).not.toContain('literal-')
  })

  it('reports empty higher priority overrides instead of hiding the configuration issue', async () => {
    await writeFile(path.join(root, '.env.local'), 'KEY_VAULTS_SECRET=\n')
    const result = await setup()
    expect(result.shadowed).toContain('.env.local: KEY_VAULTS_SECRET')
    await setup('.env.local')
    expect((await readEnv('.env.local')).KEY_VAULTS_SECRET).toBe((await readEnv()).KEY_VAULTS_SECRET)
  })

  it('refuses concurrent setup and leaves an existing secret unchanged', async () => {
    await writeFile(path.join(root, '.env'), 'KEY_VAULTS_SECRET=original\n')
    await writeFile(path.join(root, '.env.lock'), '')
    await expect(setup()).rejects.toThrow('正在初始化')
    expect((await readEnv()).KEY_VAULTS_SECRET).toBe('original')
  })

  it('protects the tracked template and refuses symlink targets', async () => {
    await expect(setup('.env.example')).rejects.toThrow('目标文件名')
    await symlink(path.join(root, '.env.example'), path.join(root, '.env'))
    await expect(setup()).rejects.toThrow('符号链接')
    expect(await readFile(path.join(root, '.env.example'), 'utf8')).toBe(TEMPLATE)
    expect((await readdir(root)).some((name) => name.endsWith('.lock'))).toBe(false)
  })

  it('fails without changing the target when an inherited secret needs variable expansion', async () => {
    await writeFile(path.join(root, '.env.local'), 'KEY_VAULTS_SECRET=$EXTERNAL_SECRET\n')
    await expect(setup()).rejects.toThrow('KEY_VAULTS_SECRET 引用了其他环境变量')
    expect(await readdir(root)).toEqual(expect.not.arrayContaining(['.env', '.env.lock']))
  })
})
