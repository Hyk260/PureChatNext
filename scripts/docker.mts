import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { constants as fsConstants, existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

import { parse } from 'dotenv'
import { exportJWK, generateKeyPair } from 'jose'

const root = path.resolve(import.meta.dirname, '..')
const devDir = path.join(root, 'docker-compose/dev')
const deployDir = path.join(root, 'docker-compose/deploy')
const devCompose = path.join(devDir, 'docker-compose.yml')
const deployCompose = path.join(deployDir, 'docker-compose.yml')
const devEnv = path.join(devDir, '.env')
const deployEnv = path.join(deployDir, '.env')

const command = process.argv[2]
const flags = new Set(process.argv.slice(3))
type EnvironmentOverrides = Record<string, string | undefined>

function run(program: string, args: string[], options?: { env?: EnvironmentOverrides }) {
  const executable = process.platform === 'win32' && program === 'pnpm' ? 'pnpm.cmd' : program
  const result = spawnSync(executable, args, {
    cwd: root,
    env: { ...process.env, ...options?.env },
    stdio: 'inherit',
  })

  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const composeArgs = (composeFile: string, envFile: string) => ['compose', '--env-file', envFile, '-f', composeFile]

function requireFile(filename: string, setupCommand: string) {
  if (!existsSync(filename)) {
    throw new Error(`缺少 ${path.relative(root, filename)}，请先运行 ${setupCommand}`)
  }
}

async function setupDev() {
  const source = path.join(devDir, '.env.example')
  await copyFile(source, devEnv, fsConstants.COPYFILE_EXCL).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'EEXIST') throw new Error('docker-compose/dev/.env 已存在，未覆盖')
    throw error
  })
  console.log('✅ 已创建 docker-compose/dev/.env')
}

const secret = (bytes = 32) => randomBytes(bytes).toString('base64url')

async function createJwks() {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true })
  const jwk = await exportJWK(privateKey)
  return JSON.stringify({
    keys: [{ ...jwk, alg: 'RS256', kid: randomBytes(8).toString('hex'), use: 'sig' }],
  })
}

async function setupDeploy() {
  if (existsSync(deployEnv)) throw new Error('docker-compose/deploy/.env 已存在，未覆盖')

  const template = await readFile(path.join(deployDir, '.env.example'), 'utf8')
  const replacements: Record<string, string> = {
    __GENERATE_AUTH_SECRET__: secret(),
    __GENERATE_CRON_SECRET__: secret(),
    __GENERATE_JWKS_KEY__: await createJwks(),
    __GENERATE_KEY_VAULTS_SECRET__: secret(),
    __GENERATE_POSTGRES_PASSWORD__: secret(24),
    __GENERATE_REDIS_PASSWORD__: secret(24),
    __GENERATE_RUSTFS_ACCESS_KEY__: secret(18),
    __GENERATE_RUSTFS_SECRET__: secret(24),
    __GENERATE_SEARXNG_SECRET__: secret(),
  }
  const contents = Object.entries(replacements).reduce(
    (value, [placeholder, replacement]) => value.replace(placeholder, replacement),
    template
  )

  await writeFile(deployEnv, contents, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  console.log('✅ 已创建 docker-compose/deploy/.env，请修改 APP_URL、ALLOWED_ORIGINS 和模型密钥')
}

async function upDev() {
  requireFile(devEnv, 'pnpm docker:setup:dev')
  run('docker', [
    ...composeArgs(devCompose, devEnv),
    'up',
    '-d',
    '--wait',
    'postgresql',
    'redis',
    'rustfs',
    'searxng',
  ])
  run('docker', [...composeArgs(devCompose, devEnv), 'up', '--no-deps', 'rustfs-init'])

  const values = parse(await readFile(devEnv, 'utf8'))
  const bindAddress = values.DOCKER_BIND_ADDRESS || '127.0.0.1'
  const host = bindAddress === '0.0.0.0' ? 'localhost' : bindAddress
  const postgresPort = values.POSTGRES_PORT || '5432'
  const redisPort = values.REDIS_PORT || '6379'
  const rustfsAdminPort = values.RUSTFS_ADMIN_PORT || '9001'
  const rustfsS3Port = values.RUSTFS_PORT || '9000'
  const searxngPort = values.SEARXNG_PORT || '8180'

  console.log('')
  console.log(`开发依赖已就绪（${host}）`)
  console.log(
    `  PostgreSQL  ${postgresPort}   凭证: docker-compose/dev/.env（POSTGRES_*）；应用侧 DATABASE_URL 见 .env.local`
  )
  console.log(`  Redis       ${redisPort}   无密码；应用侧 REDIS_URL 见 .env.local`)
  console.log(
    `  RustFS      控制台 http://${host}:${rustfsAdminPort}（对象存储管理）；S3 API :${rustfsS3Port}；密钥 RUSTFS_* 见 docker-compose/dev/.env`
  )
  console.log(
    `  SearXNG     http://${host}:${searxngPort}（联网搜索 UI / JSON API）；应用侧 SEARXNG_URL 见 .env.local`
  )
  console.log('')
}

function downDev() {
  requireFile(devEnv, 'pnpm docker:setup:dev')
  run('docker', [...composeArgs(devCompose, devEnv), 'down'])
}

async function confirmReset() {
  console.log('将删除 Docker project purechat 的 postgres_data、redis_data、rustfs_data 卷。')
  if (flags.has('--yes')) return
  if (!process.stdin.isTTY) throw new Error('非交互环境必须显式传入 --yes')

  process.stdout.write('输入 DELETE 确认：')
  const answer = await new Promise<string>((resolve) => {
    process.stdin.setEncoding('utf8')
    process.stdin.once('data', (data) => resolve(String(data).trim()))
  })
  if (answer !== 'DELETE') throw new Error('已取消，未删除任何数据')
}

async function resetDev() {
  requireFile(devEnv, 'pnpm docker:setup:dev')
  await confirmReset()
  run('docker', [...composeArgs(devCompose, devEnv), 'down', '--volumes'])
  await upDev()

  const values = parse(await readFile(devEnv, 'utf8'))
  const databaseUrl = new URL('postgresql://127.0.0.1')
  databaseUrl.username = values.POSTGRES_USER
  databaseUrl.password = values.POSTGRES_PASSWORD
  databaseUrl.port = values.POSTGRES_PORT || '5432'
  databaseUrl.pathname = `/${values.POSTGRES_DB}`
  run('pnpm', ['db:migrate'], {
    env: { DATABASE_DRIVER: 'node', DATABASE_URL: databaseUrl.toString() },
  })
}

function validate() {
  run('docker', [...composeArgs(devCompose, path.join(devDir, '.env.example')), 'config', '--quiet'])
  run('docker', [...composeArgs(deployCompose, path.join(deployDir, '.env.example')), 'config', '--quiet'])
  console.log('✅ 开发与生产 Compose 配置有效')
}

async function main() {
  switch (command) {
    case 'setup-dev':
      await setupDev()
      break
    case 'setup-deploy':
      await setupDeploy()
      break
    case 'up':
      await upDev()
      break
    case 'down':
      downDev()
      break
    case 'reset':
      await resetDev()
      break
    case 'validate':
      validate()
      break
    default:
      throw new Error('用法: bun scripts/docker.mts {setup-dev|setup-deploy|up|down|reset|validate}')
  }
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
