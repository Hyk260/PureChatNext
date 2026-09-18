import { chmod, copyFile, cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createWriteStream, existsSync, readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { spawn, spawnSync } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'

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
const extraArgs = process.argv.slice(3)
const flags = new Set(extraArgs)
type EnvironmentOverrides = Record<string, string | undefined>

function flagValue(name: string): string | undefined {
  const prefix = `--${name}=`
  const inline = extraArgs.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = extraArgs.indexOf(`--${name}`)
  if (index >= 0) return extraArgs[index + 1]
  return undefined
}

function applyEnvOverlay(contents: string, overlay: Record<string, string>) {
  let next = contents
  for (const [key, value] of Object.entries(overlay)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm')
    const line = `${key}=${value}`
    next = pattern.test(next) ? next.replace(pattern, line) : `${next.trimEnd()}\n${line}\n`
  }
  return next
}

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

function tryRun(program: string, args: string[], options?: { env?: EnvironmentOverrides }) {
  const executable = process.platform === 'win32' && program === 'pnpm' ? 'pnpm.cmd' : program
  const result = spawnSync(executable, args, {
    cwd: root,
    env: { ...process.env, ...options?.env },
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  return result.status === 0
}

const composeArgs = (composeFile: string, envFile: string) => ['compose', '--env-file', envFile, '-f', composeFile]
const DEV_SERVICES = ['postgresql', 'redis', 'rustfs', 'searxng'] as const
const PACK_APP_IMAGE = 'purechat-next:local'
const PACK_APP_ARCHIVE = 'images/purechat-next.tar.gz'

type ImagePlatformState = { status: 'present' } | { status: 'missing' } | { status: 'wrong-platform'; current: string }

type ComposeServiceConfig = {
  services: Record<string, { image?: string }>
}

function dockerOk(args: string[]) {
  return spawnSync('docker', args, { cwd: root, stdio: 'ignore' }).status === 0
}

function readComposeConfig(composeFile: string, envFile: string): ComposeServiceConfig {
  const result = spawnSync('docker', [...composeArgs(composeFile, envFile), 'config', '--format', 'json'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `docker compose config 失败 (exit ${result.status})`).trim())
  }
  return JSON.parse(result.stdout) as ComposeServiceConfig
}

function parsePinnedImage(image: string) {
  const digestIndex = image.lastIndexOf('@')
  if (digestIndex === -1) return { digest: undefined, nameTag: image }
  return {
    digest: image.slice(digestIndex + 1),
    nameTag: image.slice(0, digestIndex),
  }
}

/** 本地已有相同 digest 时补 tag，避免 Compose 因引用字符串不一致去拉 Docker Hub */
function ensureLocalImage(image: string) {
  if (dockerOk(['image', 'inspect', image])) return 'present'
  const { digest, nameTag } = parsePinnedImage(image)
  if (digest && dockerOk(['image', 'inspect', digest])) {
    run('docker', ['tag', digest, nameTag])
    return 'retagged'
  }
  return 'missing'
}

function ensureDevImages() {
  const config = readComposeConfig(devCompose, devEnv)
  const missingServices = DEV_SERVICES.filter((service) => {
    const image = config.services[service]?.image
    if (!image) throw new Error(`compose 未定义 ${service} 的 image`)
    return ensureLocalImage(image) === 'missing'
  })
  if (missingServices.length === 0) return
  run('docker', [...composeArgs(devCompose, devEnv), 'pull', ...missingServices])
}

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

  const profileFlag = extraArgs.includes('--profile') || extraArgs.some((arg) => arg.startsWith('--profile='))
  const profile = flagValue('profile') ?? '2g'
  if (profileFlag && (!flagValue('profile') || flagValue('profile')!.startsWith('--'))) {
    throw new Error('请指定部署档案，例如 pnpm docker:setup:deploy -- --profile 2g')
  }

  const template = await readFile(path.join(deployDir, '.env.example'), 'utf8')
  const replacements: Record<string, string> = {
    __GENERATE_AUTH_SECRET__: secret(),
    __GENERATE_CRON_SECRET__: secret(),
    __GENERATE_JWKS_KEY__: await createJwks(),
    __GENERATE_KEY_VAULTS_SECRET__: secret(),
    __GENERATE_POSTGRES_PASSWORD__: secret(24),
    __GENERATE_REDIS_PASSWORD__: secret(24),
  }
  let contents = Object.entries(replacements).reduce(
    (value, [placeholder, replacement]) => value.replace(placeholder, replacement),
    template
  )

  const profileFile = path.join(deployDir, 'profiles', `${profile}.env`)
  if (!existsSync(profileFile)) {
    throw new Error(`未知部署档案 --profile ${profile}，请确认 docker-compose/deploy/profiles/${profile}.env 存在`)
  }
  contents = applyEnvOverlay(contents, parse(await readFile(profileFile, 'utf8')))

  await writeFile(deployEnv, contents, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  console.log(`✅ 已创建 docker-compose/deploy/.env（已应用 --profile ${profile}）`)
  console.log('请修改 APP_URL、对象存储凭证，并确保目标主机已有可访问的 PostgreSQL（将使用用户 purechat）')
}

async function upDev() {
  requireFile(devEnv, 'pnpm docker:setup:dev')
  ensureDevImages()
  run('docker', [
    ...composeArgs(devCompose, devEnv),
    'up',
    '-d',
    '--wait',
    '--pull',
    'never',
    ...DEV_SERVICES,
  ])

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
  const args = ['up', '-d', '--wait']
  if (flags.has('--no-build')) args.push('--pull', 'never')
  else args.splice(2, 0, '--build')
  run('docker', [...composeArgs(deployCompose, deployEnv), ...args])
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
  const deployEnvExample = path.join(deployDir, '.env.example')
  const onlineCompose = path.join(deployDir, 'docker-compose.online.yml')
  run('docker', [...composeArgs(devCompose, path.join(devDir, '.env.example')), 'config', '--quiet'])
  run('docker', [...composeArgs(deployCompose, deployEnvExample), 'config', '--quiet'])
  if (!existsSync(onlineCompose)) throw new Error('缺少 docker-compose/deploy/docker-compose.online.yml')
  run(
    'docker',
    [
      'compose',
      '--env-file',
      deployEnvExample,
      '-f',
      deployCompose,
      '-f',
      onlineCompose,
      'config',
      '--quiet',
    ],
    { env: { PURECHAT_IMAGE: 'ghcr.io/hyk260/purechat-next:latest' } }
  )
  const verifyCompose = path.join(deployDir, 'docker-compose.verify.yml')
  if (!existsSync(verifyCompose)) throw new Error('缺少 docker-compose/deploy/docker-compose.verify.yml')
  run('docker', [...composeArgs(deployCompose, deployEnvExample), '-f', verifyCompose, 'config', '--quiet'])
  const installScript = path.join(deployDir, 'install.sh')
  if (!existsSync(installScript)) throw new Error('缺少 docker-compose/deploy/install.sh')
  run('bash', ['-n', installScript])
  const installOnlineScript = path.join(deployDir, 'install-online.sh')
  if (!existsSync(installOnlineScript)) throw new Error('缺少 docker-compose/deploy/install-online.sh')
  run('bash', ['-n', installOnlineScript])
  const startIpScript = path.join(deployDir, 'start-ip.sh')
  if (!existsSync(startIpScript)) throw new Error('缺少 docker-compose/deploy/start-ip.sh')
  run('bash', ['-n', startIpScript])
  const uploadScript = path.join(root, 'scripts/upload-offline.sh')
  if (!existsSync(uploadScript)) throw new Error('缺少 scripts/upload-offline.sh')
  run('bash', ['-n', uploadScript])
  console.log('✅ 开发 / 生产 / 在线 Compose 配置有效，安装脚本语法通过')
}

function platformArchitecture(platform: string) {
  const [, arch] = platform.split('/')
  return arch ?? platform
}

function imageArchitecture(image: string) {
  const result = spawnSync('docker', ['image', 'inspect', '--format', '{{.Architecture}}', image], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) return undefined
  const arch = result.stdout.trim()
  return arch || undefined
}

function inspectImagePlatform(image: string, platform: string): ImagePlatformState {
  const current = imageArchitecture(image)
  if (!current) return { status: 'missing' }
  if (current === platformArchitecture(platform)) return { status: 'present' }
  return { current, status: 'wrong-platform' }
}

function imageId(image: string) {
  const result = spawnSync('docker', ['image', 'inspect', '--format', '{{.Id}}', image], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) return undefined
  const id = result.stdout.trim()
  return id || undefined
}

function imageCreated(image: string) {
  const result = spawnSync('docker', ['image', 'inspect', '--format', '{{.Created}}', image], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) return undefined
  const created = result.stdout.trim()
  return created || undefined
}

function readDockerfileNodeBaseImage() {
  const dockerfile = readFileSync(path.join(root, 'Dockerfile'), 'utf8')
  const match = dockerfile.match(/^ARG NODE_BASE_IMAGE=(.+)$/m)
  if (!match) throw new Error('Dockerfile 缺少 ARG NODE_BASE_IMAGE')
  const pinned = match[1].trim()
  return { nameTag: parsePinnedImage(pinned).nameTag, pinned }
}

function dockerHubMirrorRef(nameTag: string, mirror: string) {
  return nameTag.includes('/') ? `${mirror}/${nameTag}` : `${mirror}/library/${nameTag}`
}

/** 无 registry 主机名的引用视为 Docker Hub（含 library/ 与 user/repo） */
function isDockerHubNameTag(nameTag: string) {
  if (!nameTag.includes('/')) return true
  const registry = nameTag.split('/')[0] ?? ''
  return !registry.includes('.') && !registry.includes(':') && registry !== 'localhost'
}

function isGhcrNameTag(nameTag: string) {
  return nameTag.startsWith('ghcr.io/')
}

/** 国内默认先走镜像站，再回落到官方；避免 pack 拉 amd64 依赖时卡在 registry-1.docker.io */
function packDepPullCandidates(image: string, useCnMirror: boolean) {
  const { digest, nameTag } = parsePinnedImage(image)
  const refs: string[] = []
  if (useCnMirror && isDockerHubNameTag(nameTag)) {
    const mirror = process.env.DOCKER_HUB_MIRROR || 'docker.m.daocloud.io'
    const mirrorNameTag = dockerHubMirrorRef(nameTag, mirror)
    // 先按 tag 拉：digest 在 Docker Desktop 上常挂到已有的多架构 index，平台选择不可靠
    refs.push(mirrorNameTag)
    if (digest) refs.push(`${mirrorNameTag}@${digest}`)
  }
  if (useCnMirror && isGhcrNameTag(nameTag)) {
    const mirror = process.env.GHCR_MIRROR || 'ghcr.nju.edu.cn'
    const mirrorNameTag = nameTag.replace(/^ghcr\.io\//, `${mirror}/`)
    refs.push(mirrorNameTag)
    if (digest) refs.push(`${mirrorNameTag}@${digest}`)
  }
  refs.push(nameTag)
  if (digest) refs.push(image)
  return [...new Set(refs)]
}

function packNodeBaseAlias(platform: string) {
  return `purechat-node-base:${platform.replaceAll('/', '-')}`
}

function tagPackNodeBase(source: string, alias: string, platform: string) {
  if (!tryRun('docker', ['tag', source, alias])) return undefined
  if (inspectImagePlatform(alias, platform).status !== 'present') return undefined
  // 必须返回命名 tag：裸 sha256 ID 会被 BuildKit 解析成 docker.io/library/sha256:...
  return alias
}

/** 镜像站常给出 OCI index（inspect 没有 Architecture），需物化成单平台再给 Dockerfile FROM */
function materializePackNodeBase(source: string, alias: string, platform: string) {
  const tagged = tagPackNodeBase(source, alias, platform)
  if (tagged) return tagged

  console.log(`将 ${source} 物化为单平台镜像 ${alias}（${platform}）`)
  const result = spawnSync(
    'docker',
    ['build', '--platform', platform, '--provenance=false', '--sbom=false', '--pull=false', '-t', alias, '-'],
    {
      cwd: root,
      encoding: 'utf8',
      input: `FROM ${source}\n`,
      stdio: ['pipe', 'inherit', 'inherit'],
    }
  )
  if (result.status !== 0) return undefined
  if (inspectImagePlatform(alias, platform).status !== 'present') return undefined
  return alias
}

/** 交叉构建 amd64 时先拿到本地 Node 基础镜像，避免 BuildKit 去 Docker Hub 解析 digest 超时 */
function ensurePackNodeBaseImage(platform: string, useCnMirror: boolean) {
  const alias = packNodeBaseAlias(platform)
  if (inspectImagePlatform(alias, platform).status === 'present') {
    console.log(`使用本地 Node 基础镜像 ${alias}（${platform}）`)
    return alias
  }

  const { nameTag, pinned } = readDockerfileNodeBaseImage()
  const mirror = process.env.DOCKER_HUB_MIRROR || 'docker.m.daocloud.io'
  const mirrorRef = dockerHubMirrorRef(nameTag, mirror)
  const localRefs = [useCnMirror ? mirrorRef : undefined, nameTag, pinned].filter((image): image is string => {
    if (!image || !imageId(image)) return false
    return inspectImagePlatform(image, platform).status !== 'wrong-platform'
  })
  for (const source of localRefs) {
    const ref = materializePackNodeBase(source, alias, platform)
    if (ref) {
      console.log(`使用本地 Node 基础镜像 ${source} → ${ref}`)
      return ref
    }
  }

  const pullRefs = useCnMirror ? [mirrorRef, pinned, nameTag] : [pinned, nameTag]
  for (const ref of pullRefs) {
    console.log(`拉取 Node 基础镜像 ${platform} ← ${ref}`)
    if (!tryRun('docker', ['pull', '--platform', platform, ref])) continue
    const materialized = materializePackNodeBase(ref, alias, platform)
    if (materialized) return materialized
    if (useCnMirror && ref === mirrorRef) {
      throw new Error(
        `已从 ${mirrorRef} 拉取 ${platform}，但无法物化为单平台镜像 ${alias}。请检查 Docker Buildx / QEMU 是否支持 ${platform}。`
      )
    }
  }

  throw new Error(
    [
      `无法拉取 ${platform} 的 Node 基础镜像 ${nameTag}。`,
      'Docker Hub 在国内常超时；USE_CN_MIRROR 只加速构建阶段的 Debian / npm，不代理 docker.io。',
      '',
      '请先执行：',
      `  docker pull --platform ${platform} ${mirrorRef}`,
      '  pnpm docker:pack',
      '',
      '或指定其它 Docker Hub 镜像后再打包：',
      `  DOCKER_HUB_MIRROR=${mirror} pnpm docker:pack`,
    ].join('\n')
  )
}

function readDeployPackImages() {
  const config = readComposeConfig(deployCompose, path.join(deployDir, '.env.example'))
  const appImage = config.services.app?.image
  if (appImage !== PACK_APP_IMAGE) {
    throw new Error(`compose app 镜像应为 ${PACK_APP_IMAGE}，实际为 ${appImage ?? '(空)'}`)
  }
  for (const bundled of ['postgresql', 'redis', 'rustfs', 'searxng']) {
    if (config.services[bundled]) {
      throw new Error(`生产 Compose 不应再内置 ${bundled}，请改用宿主机或云服务`)
    }
  }
  return { appImage }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

function packManifest(appImage: string) {
  return [
    '# image<TAB>archive',
    '# 安装脚本按此检测本地镜像；缺文件时会打印右侧路径',
    `${appImage}\t${PACK_APP_ARCHIVE}`,
    '',
  ].join('\n')
}

async function saveGzippedImages(images: string[], destFile: string, platform: string) {
  await mkdir(path.dirname(destFile), { recursive: true })
  console.log(`导出 ${images.length} 个镜像（${platform}）→ ${path.relative(root, destFile)}`)
  const child = spawn('docker', ['save', '--platform', platform, ...images], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  if (!child.stdout) throw new Error('docker save 未产生输出')
  try {
    await pipeline(child.stdout, createGzip({ level: 1 }), createWriteStream(destFile))
  } catch (error) {
    child.kill()
    throw error
  }
  const status = await new Promise<number>((resolve, reject) => {
    if (child.exitCode != null) {
      resolve(child.exitCode)
      return
    }
    child.once('error', reject)
    child.once('close', (code) => resolve(code ?? 1))
  })
  if (status !== 0) throw new Error(`docker save 失败 (exit ${status})`)
}

function buildPackAppImage(platform: string, useCnMirror: boolean) {
  const nodeBaseImage = ensurePackNodeBaseImage(platform, useCnMirror)
  const args = [
    'build',
    '--platform',
    platform,
    '--pull=false',
    '--provenance=false',
    '--sbom=false',
    '--build-arg',
    `NODE_BASE_IMAGE=${nodeBaseImage}`,
    ...(useCnMirror ? ['--build-arg', 'USE_CN_MIRROR=true'] : []),
    '-t',
    PACK_APP_IMAGE,
    '-f',
    path.join(root, 'Dockerfile'),
    root,
  ]
  console.log(`构建 ${PACK_APP_IMAGE}（${platform}${useCnMirror ? '，国内镜像' : ''}，基础镜像 ${nodeBaseImage}）`)
  // 不用 compose build：bake 会把本地 tag / sha256 改写成 docker.io/library/... 再打 Hub
  run('docker', args)
  const arch = imageArchitecture(PACK_APP_IMAGE)
  const wanted = platformArchitecture(platform)
  if (arch !== wanted) {
    throw new Error(`${PACK_APP_IMAGE} 架构为 ${arch ?? '未知'}，需要 ${platform}。请确认 Docker 支持该平台。`)
  }
}

/** Apple Silicon 上多架构 digest 的 inspect 常报 arm64，需物化成单平台再 save */
function materializePackDepImage(source: string, nameTag: string, platform: string) {
  console.log(`将 ${source} 物化为单平台镜像 ${nameTag}（${platform}）`)
  const result = spawnSync(
    'docker',
    ['build', '--platform', platform, '--provenance=false', '--sbom=false', '--pull=false', '-t', nameTag, '-'],
    {
      cwd: root,
      encoding: 'utf8',
      input: `FROM ${source}\n`,
      stdio: ['pipe', 'inherit', 'inherit'],
    }
  )
  if (result.status !== 0) return undefined
  if (inspectImagePlatform(nameTag, platform).status !== 'present') return undefined
  return nameTag
}

function pullPackDepImage(image: string, platform: string, useCnMirror: boolean) {
  const { nameTag } = parsePinnedImage(image)
  const candidates = packDepPullCandidates(image, useCnMirror)
  for (const ref of candidates) {
    console.log(`拉取 ${platform} ${image} ← ${ref}`)
    if (!tryRun('docker', ['pull', '--platform', platform, ref])) continue
    const materialized = materializePackDepImage(ref, nameTag, platform)
    if (materialized) return
  }

  const hub = process.env.DOCKER_HUB_MIRROR || 'docker.m.daocloud.io'
  const ghcr = process.env.GHCR_MIRROR || 'ghcr.nju.edu.cn'
  throw new Error(
    [
      `无法拉取并物化 ${platform} 依赖镜像 ${image}。`,
      'Docker Hub / GHCR 在国内常超时；Apple Silicon 上还需把多架构镜像物化为单平台。',
      '',
      '可手动拉取后重试，或指定镜像站：',
      `  docker pull --platform ${platform} ${packDepPullCandidates(image, true)[0] ?? image}`,
      `  DOCKER_HUB_MIRROR=${hub} GHCR_MIRROR=${ghcr} pnpm docker:pack`,
    ].join('\n')
  )
}

async function copyPackStack(staging: string) {
  const installScript = path.join(deployDir, 'install.sh')
  const startIpScript = path.join(deployDir, 'start-ip.sh')
  if (!existsSync(installScript)) throw new Error('缺少 docker-compose/deploy/install.sh')
  if (!existsSync(startIpScript)) throw new Error('缺少 docker-compose/deploy/start-ip.sh')
  await mkdir(path.join(staging, 'images'), { recursive: true })
  await mkdir(path.join(staging, 'docker-compose/deploy'), { recursive: true })
  await copyFile(installScript, path.join(staging, 'install.sh'))
  await chmod(path.join(staging, 'install.sh'), 0o755)
  await copyFile(installScript, path.join(staging, 'docker-compose/deploy/install.sh'))
  await chmod(path.join(staging, 'docker-compose/deploy/install.sh'), 0o755)
  await copyFile(startIpScript, path.join(staging, 'start-ip.sh'))
  await chmod(path.join(staging, 'start-ip.sh'), 0o755)
  await copyFile(startIpScript, path.join(staging, 'docker-compose/deploy/start-ip.sh'))
  await chmod(path.join(staging, 'docker-compose/deploy/start-ip.sh'), 0o755)
  await copyFile(deployCompose, path.join(staging, 'docker-compose/deploy/docker-compose.yml'))
  await copyFile(path.join(deployDir, '.env.example'), path.join(staging, 'docker-compose/deploy/.env.example'))
  await cp(path.join(deployDir, 'profiles'), path.join(staging, 'docker-compose/deploy/profiles'), {
    recursive: true,
  })
}

async function pack() {
  ensureDockerReady()
  const platform = flagValue('platform') ?? 'linux/amd64'
  const skipBuild = flags.has('--skip-build')
  if (flags.has('--app-only')) {
    console.log('ℹ️  生产离线包默认只含应用镜像，--app-only 可省略')
  }
  const useCnMirror = !flags.has('--no-cn-mirror')
  const outputDir = path.resolve(root, flagValue('output') ?? 'dist/docker-offline')
  const staging = path.join(outputDir, 'purechat-next-offline')
  const tarPath = path.join(outputDir, 'purechat-next-offline.tar')
  const { appImage } = readDeployPackImages()

  const appState = inspectImagePlatform(appImage, platform)
  if (skipBuild) {
    if (appState.status !== 'present') {
      const reason =
        appState.status === 'wrong-platform'
          ? `${appImage} 架构为 ${appState.current}，云服务器需要 ${platform}`
          : `缺少 ${appImage}`
      throw new Error(`${reason}。请去掉 --skip-build 后重新打包`)
    }
    const created = imageCreated(appImage)
    console.log(`跳过构建，导出已有 ${appImage}（${platform}${created ? `，Created ${created}` : ''}）`)
    console.log('⚠️  --skip-build 不会根据当前源码重建镜像。升级请去掉该参数后重新打包')
  } else {
    if (appState.status === 'wrong-platform') {
      console.log(`${appImage} 架构为 ${appState.current}，将按 ${platform} 重新构建`)
    }
    buildPackAppImage(platform, useCnMirror)
  }

  await rm(staging, { recursive: true, force: true })
  await copyPackStack(staging)
  await writeFile(path.join(staging, 'images/manifest.txt'), packManifest(appImage), 'utf8')
  await saveGzippedImages([appImage], path.join(staging, PACK_APP_ARCHIVE), platform)

  await rm(tarPath, { force: true })
  run('tar', ['-cf', tarPath, '-C', staging, '.'], { env: { COPYFILE_DISABLE: '1' } })

  const tarStat = await stat(tarPath)
  console.log(`✅ 离线包已生成：${path.relative(root, tarPath)}（${formatBytes(tarStat.size)}）`)
  console.log('包内仅含应用镜像。目标主机需已有 PostgreSQL（必须）与 Redis（可选），并配置对象存储。')
  console.log('本机一键（先复制 docker-compose/deploy/upload.env.example → upload.env）：')
  console.log('  # 首次上传并安装（把 APP_URL 换成你的 HTTPS 地址）')
  console.log('  pnpm docker:upload -- --install --app-url https://chat.example.com')
  console.log('  # 一键升级（上传、解压并执行 install.sh up，不覆盖已有 .env）')
  console.log('  pnpm docker:upload -- --up')
  console.log('上传后也可在服务器手动执行：')
  console.log(`  sudo mkdir -p /opt/purechat && sudo tar -xf ${path.basename(tarPath)} -C /opt/purechat`)
  console.log('  sudo APP_URL=https://chat.example.com /opt/purechat/install.sh')
  console.log('  # 临时用公网 IP：')
  console.log('  sudo /opt/purechat/start-ip.sh')
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
    case 'pack':
      await pack()
      break
    default:
      throw new Error(
        '用法: bun scripts/docker.mts {setup-dev|setup-deploy|deploy|pack|up|down|reset|validate} [--profile 2g] [--no-build] [--skip-build] [--app-only]'
      )
  }
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
