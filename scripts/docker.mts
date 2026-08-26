import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3'
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

function isDockerDaemonDown(output: string) {
  return /docker\.sock|Cannot connect to the Docker daemon|Is the docker daemon running|failed to connect to the docker API|The system cannot find the file specified/i.test(
    output
  )
}

/** 启动依赖前检查 Docker CLI / 守护进程，失败时给出中文操作指引 */
function ensureDockerReady() {
  const result = spawnSync('docker', ['info'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      throw new Error(
        [
          '未检测到 Docker 命令（未安装或不在 PATH 中）。',
          '',
          '请按以下步骤操作：',
          '  1. 安装 Docker Desktop：https://www.docker.com/products/docker-desktop/',
          '  2. 安装完成后打开 Docker Desktop',
          '  3. 等待引擎启动完成，再执行：pnpm run dev:docker',
        ].join('\n')
      )
    }
    throw result.error
  }

  if (result.status === 0) return

  const output = `${result.stderr ?? ''}\n${result.stdout ?? ''}`.trim()
  if (isDockerDaemonDown(output)) {
    const steps =
      process.platform === 'darwin'
        ? [
            '  1. 打开 Docker Desktop（启动台 / 应用程序）',
            '  2. 等待菜单栏鲸鱼图标变为 Running（引擎已启动）',
            '  3. 再执行：pnpm run dev:docker',
          ]
        : process.platform === 'win32'
          ? ['  1. 打开 Docker Desktop', '  2. 等待托盘图标显示 Running', '  3. 再执行：pnpm run dev:docker']
          : [
              '  1. 启动 Docker 服务，例如：sudo systemctl start docker',
              '  2. 确认当前用户已加入 docker 组（或使用有权限的方式）',
              '  3. 再执行：pnpm run dev:docker',
            ]

    throw new Error(
      [
        'Docker 已安装，但守护进程未运行（无法连接 docker.sock）。',
        '',
        '请按以下步骤操作：',
        ...steps,
        '',
        '自检命令：docker info',
      ].join('\n')
    )
  }

  throw new Error(`Docker 不可用（exit ${result.status ?? 1}）${output ? `：\n${output}` : ''}`)
}

async function setupDev() {
  const source = path.join(devDir, '.env.example')
  const template = await readFile(source, 'utf8')
  const replacements: Record<string, string> = {
    __GENERATE_POSTGRES_PASSWORD__: secret(24),
    __GENERATE_RUSTFS_ACCESS_KEY__: secret(18),
    __GENERATE_RUSTFS_SECRET__: secret(24),
    __GENERATE_SEARXNG_SECRET__: secret(),
  }
  const contents = Object.entries(replacements).reduce(
    (value, [placeholder, replacement]) => value.replace(placeholder, replacement),
    template
  )

  await writeFile(devEnv, contents, { encoding: 'utf8', flag: 'wx', mode: 0o600 }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'EEXIST') throw new Error('docker-compose/dev/.env 已存在，未覆盖')
      throw error
    }
  )
  console.log('✅ 已创建 docker-compose/dev/.env（已生成随机本地凭证）')
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
  run('docker', [...composeArgs(devCompose, devEnv), 'up', '-d', '--wait', 'postgresql', 'redis', 'rustfs', 'searxng'])

  const values = parse(await readFile(devEnv, 'utf8'))
  await ensureDevBucket(values)
  const bindAddress = values.DOCKER_BIND_ADDRESS || '127.0.0.1'
  const host = bindAddress === '0.0.0.0' ? 'localhost' : bindAddress
  const postgresPort = values.POSTGRES_PORT || '5432'
  const redisPort = values.REDIS_PORT || '6379'
  const rustfsAdminPort = values.RUSTFS_ADMIN_PORT || '9001'
  const rustfsS3Port = values.RUSTFS_PORT || '9000'
  const searxngPort = values.SEARXNG_PORT || '8180'

  printDevReadySummary({
    host,
    postgresPort,
    redisPort,
    rustfsAdminPort,
    rustfsS3Port,
    searxngPort,
  })
}

const isMissingBucket = (error: unknown) =>
  ['NoSuchBucket', 'NotFound'].includes((error as { name?: string })?.name ?? '') ||
  (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 404

const isAlreadyOwned = (error: unknown) =>
  ['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes((error as { name?: string })?.name ?? '') ||
  (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 409

async function ensureDevBucket(values: Record<string, string>) {
  const port = values.RUSTFS_PORT || '9000'
  const endpoint = `http://127.0.0.1:${port}`
  const bucket = values.RUSTFS_BUCKET
  const accessKeyId = values.RUSTFS_ACCESS_KEY
  const secretAccessKey = values.RUSTFS_SECRET_KEY
  if (!bucket || !accessKeyId || !secretAccessKey) throw new Error('开发 RustFS 凭证或 bucket 配置不完整')

  const client = new S3Client({
    credentials: { accessKeyId, secretAccessKey },
    endpoint,
    forcePathStyle: true,
    region: 'us-east-1',
  })

  let lastError: unknown
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }))
      return
    } catch (error) {
      lastError = error
      if (isMissingBucket(error)) {
        try {
          await client.send(new CreateBucketCommand({ Bucket: bucket }))
        } catch (createError) {
          if (!isAlreadyOwned(createError)) lastError = createError
        }
        try {
          await client.send(new HeadBucketCommand({ Bucket: bucket }))
          return
        } catch (verifyError) {
          lastError = verifyError
        }
      }
      if (attempt < 30) await new Promise((resolve) => setTimeout(resolve, 2_000))
    }
  }

  throw lastError
}

function printDevReadySummary(ports: {
  host: string
  postgresPort: string
  redisPort: string
  rustfsAdminPort: string
  rustfsS3Port: string
  searxngPort: string
}) {
  const { host, postgresPort, redisPort, rustfsAdminPort, rustfsS3Port, searxngPort } = ports
  const rustfsConsole = `http://${host}:${rustfsAdminPort}`
  const rustfsS3 = `http://${host}:${rustfsS3Port}`
  const searxng = `http://${host}:${searxngPort}`

  console.log('')
  console.log(`  ${c.cyan(c.bold('DOCKER'))} ${c.green('ready')}`)
  console.log('')
  printReadyLine(
    'PostgreSQL',
    `${host}:${postgresPort}`,
    c.dim('凭证 POSTGRES_* / DATABASE_URL 见 docker-compose/dev/.env、.env.local')
  )
  printReadyLine('Redis', `${host}:${redisPort}`, c.dim('无密码；REDIS_URL 见 .env.local'))
  printReadyLine(
    'RustFS',
    rustfsConsole,
    `${c.dim('控制台；S3 ')}${colorLink(rustfsS3)}${c.dim('；密钥 RUSTFS_* 见 docker-compose/dev/.env')}`
  )
  printReadyLine('SearXNG', searxng, c.dim('联网搜索 UI / JSON API；SEARXNG_URL 见 .env.local'))
  console.log('')
}

const supportsColor = !process.env.NO_COLOR && process.env.FORCE_COLOR !== '0' && Boolean(process.stdout.isTTY)

const wrap = (open: string, close: string) => (text: string) => (supportsColor ? `${open}${text}${close}` : text)

const c = {
  bold: wrap('\x1b[1m', '\x1b[22m'),
  cyan: wrap('\x1b[36m', '\x1b[39m'),
  dim: wrap('\x1b[2m', '\x1b[22m'),
  green: wrap('\x1b[32m', '\x1b[39m'),
}

/** 整段着色，避免端口中间插入样式打断终端 URL 识别 */
const colorLink = (value: string) => c.cyan(value)

function printReadyLine(label: string, value: string, note: string) {
  const labelWidth = 10
  console.log(`  ${c.green('➜')}  ${c.bold(`${label}:`.padEnd(labelWidth + 1))} ${colorLink(value)}`)
  console.log(`                 ${note}`)
}

function downDev() {
  requireFile(devEnv, 'pnpm docker:setup:dev')
  run('docker', [...composeArgs(devCompose, devEnv), 'down'])
}

function deploy() {
  requireFile(deployEnv, 'pnpm docker:setup:deploy')
  run('docker', [...composeArgs(deployCompose, deployEnv), 'up', '-d', '--build', '--wait'])
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
    case 'deploy':
      ensureDockerReady()
      deploy()
      break
    case 'up':
      ensureDockerReady()
      await upDev()
      break
    case 'down':
      ensureDockerReady()
      downDev()
      break
    case 'reset':
      ensureDockerReady()
      await resetDev()
      break
    case 'validate':
      ensureDockerReady()
      validate()
      break
    default:
      throw new Error('用法: pnpm exec tsx scripts/docker.mts {setup-dev|setup-deploy|deploy|up|down|reset|validate}')
  }
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
