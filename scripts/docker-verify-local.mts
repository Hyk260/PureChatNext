import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'

import { exportJWK, generateKeyPair } from 'jose'

const root = path.resolve(import.meta.dirname, '..')
const composeFile = path.join(root, 'docker-compose/deploy/docker-compose.yml')
const templateFile = path.join(root, 'docker-compose/deploy/.env.example')
const keep = process.argv.includes('--keep')
const skipBuild = process.argv.includes('--skip-build')
const skipScan = process.argv.includes('--skip-scan')
const externalScan = process.argv.includes('--external-scan')
const platform =
  process.argv.find((arg) => arg.startsWith('--platform='))?.slice('--platform='.length) ??
  (() => {
    const index = process.argv.indexOf('--platform')
    return index >= 0 ? process.argv[index + 1] : undefined
  })()
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'purechat-docker-verify-'))
const envFile = path.join(tempRoot, '.env')
const project = `purechat-verify-${randomBytes(6).toString('hex')}`
const persistenceKey = `docker-verify-${randomBytes(8).toString('hex')}`
let composeEnv: NodeJS.ProcessEnv | undefined

type CommandOptions = { allowFailure?: boolean; capture?: boolean; redact?: string[] }

const composeArgs = (...args: string[]) => [
  'compose',
  '--project-name',
  project,
  '--env-file',
  envFile,
  '--file',
  composeFile,
  ...args,
]

function command(program: string, args: string[], options?: CommandOptions) {
  const result = spawnSync(program, args, {
    cwd: root,
    encoding: 'utf8',
    env: composeEnv,
    stdio: options?.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0 && !options?.allowFailure) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
    const redactions = options?.redact ?? []
    const safeArgs = args.map((arg) =>
      redactions.reduce((value, secret) => value.replaceAll(secret, '<redacted>'), arg)
    )
    const safeOutput = redactions.reduce((value, secret) => value.replaceAll(secret, '<redacted>'), output)
    throw new Error(
      `${program} ${safeArgs.join(' ')} failed (${result.status ?? 1})${safeOutput ? `\n${safeOutput}` : ''}`
    )
  }
  return {
    status: result.status ?? 1,
    stderr: result.stderr?.trim() ?? '',
    stdout: result.stdout?.trim() ?? '',
  }
}

function output(program: string, args: string[], options?: CommandOptions) {
  return command(program, args, { ...options, capture: true }).stdout
}

async function availablePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') return reject(new Error('无法分配验证端口'))
      server.close(() => resolve(address.port))
    })
  })
}

const secret = (bytes = 24) => randomBytes(bytes).toString('base64url')

async function createEnv() {
  const port = await availablePort()
  const template = await readFile(templateFile, 'utf8')
  const { privateKey } = await generateKeyPair('RS256', { extractable: true })
  const jwks = JSON.stringify({
    keys: [{ ...(await exportJWK(privateKey)), alg: 'RS256', kid: 'docker-verify', use: 'sig' }],
  })
  const replacements: Record<string, string> = {
    __GENERATE_AUTH_SECRET__: secret(),
    __GENERATE_CRON_SECRET__: secret(),
    __GENERATE_JWKS_KEY__: jwks,
    __GENERATE_KEY_VAULTS_SECRET__: secret(),
    __GENERATE_POSTGRES_PASSWORD__: secret(),
    __GENERATE_REDIS_PASSWORD__: secret(),
    __GENERATE_RUSTFS_ACCESS_KEY__: `verify-${secret(12)}`,
    __GENERATE_RUSTFS_SECRET__: secret(),
    __GENERATE_SEARXNG_SECRET__: secret(),
  }
  let contents = Object.entries(replacements).reduce(
    (value, [placeholder, replacement]) => value.replaceAll(placeholder, replacement),
    template
  )
  contents = `${contents}\nDEPLOY_ENV_FILE=${envFile}\nAPP_PORT=${port}\nAPP_URL=http://127.0.0.1:${port}\nALLOWED_ORIGINS=http://127.0.0.1:${port}\nCHANNEL_GATEWAY_ENABLED=0\n`
  await writeFile(envFile, contents, { encoding: 'utf8', mode: 0o600 })
  await chmod(envFile, 0o600)
  const isolatedEnv = Object.fromEntries(
    contents
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator), line.slice(separator + 1)]
      })
  )
  composeEnv = {
    ...process.env,
    ...isolatedEnv,
    COMPOSE_PROJECT_NAME: project,
    ...(platform ? { DOCKER_DEFAULT_PLATFORM: platform } : {}),
  }
  return { contents, port }
}

function envValue(contents: string, name: string) {
  const match = contents.match(new RegExp(`^${name}=(.*)$`, 'm'))
  if (!match?.[1] || match[1].includes('__GENERATE_')) throw new Error(`验证环境变量 ${name} 缺失或仍是占位符`)
  return match[1]
}

function inspectContainer(service: string) {
  const id = output('docker', composeArgs('ps', '-q', service))
  if (!id) throw new Error(`容器 ${service} 未运行`)
  const raw = output('docker', ['inspect', id])
  return {
    id,
    value: JSON.parse(raw)[0] as {
      Config: { Cmd?: string[]; Env?: string[]; Image?: string; User?: string }
      HostConfig: {
        CapAdd?: string[]
        CapDrop?: string[]
        NanoCpus?: number
        Memory?: number
        PidsLimit?: number
        Privileged?: boolean
        ReadonlyRootfs?: boolean
        SecurityOpt?: string[]
      }
      Mounts?: Array<{ Destination: string; RW: boolean }>
      NetworkSettings?: {
        Ports?: Record<string, Array<{ HostIp: string; HostPort: string }> | null>
      }
    },
  }
}

function serviceNetworkNames(networks: unknown) {
  return Array.isArray(networks) ? networks : Object.keys(networks ?? {})
}

function assertComposeDefinition() {
  const config = JSON.parse(output('docker', composeArgs('config', '--format', 'json'))) as {
    services: Record<string, { container_name?: string; networks?: unknown; image?: string }>
    networks: Record<string, { internal?: boolean }>
  }
  for (const [service, definition] of Object.entries(config.services)) {
    if (definition.container_name) throw new Error(`${service} 不得设置 container_name`)
  }
  const dataMembers = Object.entries(config.services)
    .filter(([, definition]) => serviceNetworkNames(definition.networks).includes('data-network'))
    .map(([service]) => service)
    .sort()
  const appMembers = Object.entries(config.services)
    .filter(([, definition]) => serviceNetworkNames(definition.networks).includes('app-network'))
    .map(([service]) => service)
    .sort()
  if (dataMembers.join(',') !== 'app,postgresql,redis,rustfs') throw new Error(`data-network 成员错误: ${dataMembers}`)
  if (appMembers.join(',') !== 'app,searxng') throw new Error(`app-network 成员错误: ${appMembers}`)
  if (!config.networks['data-network']?.internal) throw new Error('data-network 必须 internal')
  if (config.networks['app-network']?.internal) throw new Error('app-network 必须允许 app 到搜索服务的出网')
  for (const service of ['postgresql', 'redis', 'rustfs', 'searxng']) {
    if (!config.services[service]?.image?.includes('@sha256:')) {
      throw new Error(`${service} 的生产镜像必须固定多架构 digest`)
    }
  }
}

async function assertSecurity(contents: string, port: number) {
  const expectedUsers: Record<string, string> = {
    app: '1001:1001',
    redis: 'redis',
    rustfs: 'rustfs:rustfs',
    searxng: 'searxng:searxng',
  }
  for (const service of ['app', 'postgresql', 'redis', 'rustfs', 'searxng']) {
    const container = inspectContainer(service)
    const host = container.value.HostConfig
    if (service === 'postgresql') {
      if (container.value.Config.User !== '0:0') throw new Error('PostgreSQL 必须由官方 entrypoint 短暂以 root 启动')
    } else if (container.value.Config.User !== expectedUsers[service]) {
      throw new Error(`${service} user=${container.value.Config.User}，期望 ${expectedUsers[service]}`)
    }
    if (host.Privileged) throw new Error(`${service} 不得以 privileged 运行`)
    if (!host.ReadonlyRootfs) throw new Error(`${service} rootfs 不是只读`)
    if (!host.CapDrop?.some((cap) => cap.toUpperCase() === 'ALL'))
      throw new Error(`${service} 未 drop ALL capabilities`)
    if (!host.SecurityOpt?.some((option) => option === 'no-new-privileges:true')) {
      throw new Error(`${service} 未启用 no-new-privileges`)
    }
    if (
      !host.Memory ||
      host.Memory <= 0 ||
      !host.NanoCpus ||
      host.NanoCpus <= 0 ||
      !host.PidsLimit ||
      host.PidsLimit <= 0
    ) {
      throw new Error(`${service} 未配置有效资源上限`)
    }
    if (container.value.Config.Env?.some((item) => item.includes('__GENERATE_'))) {
      throw new Error(`${service} 仍包含环境变量占位符`)
    }
  }

  const expectedMemory: Record<string, number> = {
    app: 1024 * 1024 * 1024,
    postgresql: 1024 * 1024 * 1024,
    redis: 768 * 1024 * 1024,
    rustfs: 768 * 1024 * 1024,
    searxng: 768 * 1024 * 1024,
  }
  for (const service of Object.keys(expectedMemory)) {
    if (inspectContainer(service).value.HostConfig.Memory !== expectedMemory[service]) {
      throw new Error(`${service} memory limit 与生产基线不符`)
    }
  }

  const postgresCaps = inspectContainer('postgresql').value.HostConfig.CapAdd ?? []
  const allowedPostgresCaps = ['CHOWN', 'DAC_OVERRIDE', 'FOWNER', 'SETGID', 'SETUID']
  if (postgresCaps.some((cap) => !allowedPostgresCaps.includes(cap.toUpperCase().replace(/^CAP_/, '')))) {
    throw new Error(`PostgreSQL capabilities 超出最小集合: ${postgresCaps}`)
  }
  const redis = inspectContainer('redis').value
  const redisCommand = redis.Config.Cmd?.join(' ') ?? ''
  if (
    !redisCommand.includes('REDIS_PASSWORD') ||
    !redisCommand.includes('noeviction') ||
    !redisCommand.includes('384mb')
  ) {
    throw new Error('Redis 未通过 shell 环境变量启用密码、384mb noeviction')
  }
  if (!redisCommand.includes('--requirepass')) throw new Error('Redis 未启用 requirepass')
  const searx = inspectContainer('searxng').value
  if (!searx.Config.Env?.includes('FORCE_OWNERSHIP=false')) throw new Error('SearXNG 未设置 FORCE_OWNERSHIP=false')
  if (!searx.Mounts?.some((mount) => mount.Destination === '/var/cache/searxng' && mount.RW)) {
    throw new Error('SearXNG 缓存未使用持久化可写卷')
  }

  for (const service of ['postgresql', 'redis', 'rustfs', 'searxng']) {
    const ports = inspectContainer(service).value.NetworkSettings?.Ports ?? {}
    if (Object.values(ports).some((bindings) => bindings && bindings.length > 0)) {
      throw new Error(`${service} 不应发布任何端口到宿主机`)
    }
  }
  const appBindings = inspectContainer('app').value.NetworkSettings?.Ports?.['3210/tcp'] ?? []
  if (appBindings.length !== 1 || appBindings[0]?.HostIp !== '127.0.0.1' || appBindings[0]?.HostPort !== String(port)) {
    throw new Error(`app 端口未唯一限制到 127.0.0.1:${port}`)
  }

  const runtimeUid = (service: string) => output('docker', composeArgs('exec', '-T', service, 'id', '-u'))
  if (runtimeUid('app') !== '1001') throw new Error('app runtime UID 不是 1001')
  if (runtimeUid('redis') !== '999') throw new Error('redis runtime UID 不是 999')
  if (runtimeUid('rustfs') !== '10001') throw new Error('rustfs runtime UID 不是 10001')
  if (runtimeUid('searxng') !== '977') throw new Error('searxng runtime UID 不是 977')
  const postgresTop = output('docker', ['top', inspectContainer('postgresql').id, '-eo', 'pid,uid,user,args'])
  if (!postgresTop.split('\n').some((line) => /^\s*\d+\s+70\s+/.test(line) && /postgres/i.test(line))) {
    throw new Error(`PostgreSQL 主进程未以 UID 70 运行:\n${postgresTop}`)
  }

  const dataNetwork =
    JSON.parse(output('docker', ['network', 'inspect', `${project}_data-network`]))[0]?.Containers ?? {}
  if (Object.keys(dataNetwork).length !== 4) throw new Error('data-network 成员不符合分段预期')
  const appNetwork = JSON.parse(output('docker', ['network', 'inspect', `${project}_app-network`]))[0]?.Containers ?? {}
  if (Object.keys(appNetwork).length !== 2) throw new Error('app-network 成员不符合分段预期')

  const requiredSecrets = [
    'AUTH_SECRET',
    'KEY_VAULTS_SECRET',
    'JWKS_KEY',
    'CRON_SECRET',
    'POSTGRES_PASSWORD',
    'REDIS_PASSWORD',
    'RUSTFS_SECRET_KEY',
    'SEARXNG_SECRET',
  ]
  for (const name of requiredSecrets) envValue(contents, name)
  const secrets = ['REDIS_PASSWORD', 'RUSTFS_ACCESS_KEY', 'RUSTFS_SECRET_KEY'].map((name) => envValue(contents, name))
  for (const service of ['app', 'postgresql', 'redis', 'rustfs', 'searxng']) {
    const commandLine = inspectContainer(service).value.Config.Cmd?.join(' ') ?? ''
    if (secrets.some((value) => commandLine.includes(value))) {
      throw new Error(`${service} 的 Config.Cmd 暴露了运行时凭证`)
    }
  }
  const logs = output('docker', composeArgs('logs', '--no-color'))
  if (secrets.some((value) => logs.includes(value))) throw new Error('容器日志暴露了 Redis/RustFS 凭证')
  const mode = (await stat(envFile)).mode & 0o777
  if (mode !== 0o600) throw new Error(`临时环境文件权限为 ${mode.toString(8)}，期望 600`)
}

async function fetchHealth(port: number) {
  const response = await fetch(`http://127.0.0.1:${port}/api/health`)
  const body = await response.text()
  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    payload = body
  }
  console.log(`[health] HTTP ${response.status} ${JSON.stringify(payload)}`)
  if (!response.ok) throw new Error(`健康检查 HTTP ${response.status}: ${JSON.stringify(payload)}`)
  if (!payload || typeof payload !== 'object' || (payload as { status?: string }).status !== 'ok') {
    throw new Error(`健康检查未返回 status=ok: ${JSON.stringify(payload)}`)
  }
  const checks = (payload as { checks?: Record<string, string> }).checks
  for (const dependency of ['database', 'redis', 'storage', 'search']) {
    if (checks?.[dependency] !== 'ok') {
      throw new Error(`健康检查依赖 ${dependency} 未返回 ok: ${JSON.stringify(checks?.[dependency])}`)
    }
  }
  const gateway = (payload as { gateway?: { enabled?: boolean } }).gateway
  if (gateway?.enabled !== false) throw new Error(`隔离验证必须关闭 Channel Gateway: ${JSON.stringify(gateway)}`)
  return payload
}

async function waitForHealth(port: number) {
  let lastError: unknown
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      return await fetchHealth(port)
    } catch (error) {
      lastError = error
      if (attempt < 30) await new Promise((resolve) => setTimeout(resolve, 2_000))
    }
  }
  throw lastError
}

function migrationCount() {
  const count = output(
    'docker',
    composeArgs(
      'exec',
      '-T',
      'postgresql',
      'psql',
      '-U',
      'purechat',
      '-d',
      'purechat',
      '-Atc',
      'select count(*) from drizzle.__drizzle_migrations'
    )
  )
  if (!/^\d+$/.test(count) || Number(count) <= 0) throw new Error(`迁移记录必须大于 0，实际为 ${count}`)
  return count
}

function redisCli(password: string, ...args: string[]) {
  return command(
    'docker',
    composeArgs('exec', '-T', '-e', `REDISCLI_AUTH=${password}`, 'redis', 'redis-cli', ...args),
    {
      capture: true,
      redact: [password],
    }
  )
}

function assertRedisAuth(password: string) {
  const unauthenticated = command('docker', composeArgs('exec', '-T', 'redis', 'redis-cli', 'ping'), {
    allowFailure: true,
    capture: true,
  })
  if (!`${unauthenticated.stdout}\n${unauthenticated.stderr}`.includes('NOAUTH')) throw new Error('Redis 未返回 NOAUTH')
  if (redisCli(password, 'ping').stdout !== 'PONG') throw new Error('Redis 认证 PING 失败')
  if (redisCli(password, 'set', 'docker-verify:persistence', 'ok').stdout !== 'OK') throw new Error('Redis 写入失败')
}

function writePostgresData() {
  command(
    'docker',
    composeArgs(
      'exec',
      '-T',
      'postgresql',
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'purechat',
      '-d',
      'purechat',
      '-c',
      "create table if not exists docker_verify_persistence (id integer primary key, value text not null); insert into docker_verify_persistence (id, value) values (1, 'ok') on conflict (id) do update set value = excluded.value"
    )
  )
}

function assertPostgresData() {
  const value = output(
    'docker',
    composeArgs(
      'exec',
      '-T',
      'postgresql',
      'psql',
      '-U',
      'purechat',
      '-d',
      'purechat',
      '-Atc',
      'select value from docker_verify_persistence where id = 1'
    )
  )
  if (value !== 'ok') throw new Error(`PostgreSQL 数据未持久化: ${value}`)
}

function s3Command(mode: 'write' | 'read' | 'delete', key: string) {
  command(
    'docker',
    composeArgs(
      'exec',
      '-T',
      '-e',
      `S3_VERIFY_MODE=${mode}`,
      '-e',
      `S3_VERIFY_OBJECT=${key}`,
      'app',
      'node',
      '/app/docker-s3-init.mjs'
    )
  )
}

function assertSearch() {
  command(
    'docker',
    composeArgs(
      'exec',
      '-T',
      'app',
      'node',
      '-e',
      "fetch('http://searxng:8080/search?q=purechat&format=json').then(async (response) => { const body = await response.text(); if (!response.ok) throw new Error(body); JSON.parse(body) })"
    )
  )
}

function scoutGate() {
  for (const service of ['app', 'postgresql', 'redis', 'rustfs', 'searxng']) {
    const { id } = inspectContainer(service)
    const image = output('docker', ['inspect', id, '--format', '{{.Config.Image}}'])
    command('docker', ['scout', 'cves', '--only-severity', 'critical,high', '--exit-code', `local://${image}`])
  }
}

async function smokeAndPersistence(contents: string, port: number, key: string) {
  await waitForHealth(port)
  const count = migrationCount()
  const password = envValue(contents, 'REDIS_PASSWORD')
  assertRedisAuth(password)
  s3Command('write', key)
  assertSearch()
  writePostgresData()

  command('docker', composeArgs('restart'))
  command('docker', composeArgs('up', '-d', '--wait'))
  await waitForHealth(port)
  if (migrationCount() !== count) throw new Error('PostgreSQL 迁移记录在重启后发生变化')
  if (redisCli(password, 'get', 'docker-verify:persistence').stdout !== 'ok') throw new Error('Redis 数据未持久化')
  assertPostgresData()
  s3Command('read', key)
  s3Command('delete', key)
}

async function main() {
  let started = false
  try {
    const { contents, port } = await createEnv()
    assertComposeDefinition()
    if (!skipBuild) {
      command('docker', composeArgs('build', '--pull', 'app'))
    }
    started = true
    command('docker', composeArgs('up', '-d', '--wait'))
    await assertSecurity(contents, port)
    await smokeAndPersistence(contents, port, persistenceKey)
    if (skipScan) {
      console.warn('⚠️ 已显式跳过镜像漏洞门禁；此选项仅供隔离环境排障，不得用于生产验收')
    } else if (externalScan) {
      console.log('ℹ️ 镜像漏洞门禁由外部扫描步骤执行')
    } else {
      scoutGate()
    }
    console.log(`✅ Docker 本地验证通过（project=${project}, port=${port}${platform ? `, platform=${platform}` : ''}）`)
  } finally {
    if (keep && started) {
      console.log(`ℹ️ 已保留验证 project=${project}，临时环境文件：${envFile}`)
    } else {
      if (started) command('docker', composeArgs('down', '--volumes', '--remove-orphans'), { allowFailure: true })
      await rm(tempRoot, { force: true, recursive: true })
    }
  }
}

main().catch((error) => {
  console.error(`❌ Docker 本地验证失败：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
