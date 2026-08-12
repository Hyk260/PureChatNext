/**
 * 本地生产预览：用生产环境变量运行完整 build + migration + next start（同域 SPA + API）。
 *
 * ## 用途
 * - 由 `pnpm preview:prod` 调用
 * - Env 文件加载顺序（后者覆盖前者）：
 *   `.env` → `.env.production` → `.env.local` → `.env.production.local`
 * - 调用方显式传入的环境变量优先于 Env 文件
 * - 强制覆写本地可访问地址：`APP_URL=http://localhost:<port>`，并确保 `ALLOWED_ORIGINS` 含该 origin
 * - 默认端口 `3210`（与 `pnpm start` 一致）
 * - 默认顺序：build → 校验构建产物 → db:migrate → next start → /api/health 就绪检测
 *
 * ## 使用
 * ```bash
 * pnpm preview:prod                              # build + migrate + start
 * pnpm preview:prod -- --skip-build              # 跳过构建，仍会校验已有构建产物并迁移
 * pnpm preview:prod -- --skip-migrate            # 跳过迁移
 * pnpm preview:prod -- --skip-build --skip-migrate
 * pnpm preview:prod -- --port 3211               # 自定义端口（也支持 -p）
 * PORT=3211 pnpm preview:prod                    # 等价
 * ```
 *
 * ## 访问
 * - UI + API（同域）：http://localhost:3210/
 *
 * ## 注意
 * - 需要本机 bun；`.env.production.local` 必须存在
 * - 默认会迁移并连接生产 DB，也会连接生产 S3 / Redis；写操作会影响真实数据
 * - 仅在确认目标数据库已经迁移后使用 `--skip-migrate`
 * - 本地 `build:spa:copy` 会改写 `spaHtmlTemplate.generated.ts`，勿提交构建产物
 */

import type { ChildProcess, SpawnOptions } from 'node:child_process'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { config as loadDotenv } from 'dotenv'

interface ProcessExit {
  code: number | null
  signal: NodeJS.Signals | null
}

interface HealthProbe {
  httpStatus: number
  status?: string
}

const isWindows = process.platform === 'win32'
const DEFAULT_PORT = 3210
const MAX_PORT = 65_535
const FORCE_KILL_TIMEOUT_MS = 5_000
const READY_TIMEOUT_MS = 60_000
const READY_RETRY_MS = 500
const HEALTH_REQUEST_TIMEOUT_MS = 2_000
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..')
const PRODUCTION_LOCAL_ENV = path.join(ROOT_DIR, '.env.production.local')
const BUILD_ID_FILE = path.join(ROOT_DIR, '.next', 'BUILD_ID')
const INVOCATION_ENV = { ...process.env }

const ENV_FILES = ['.env', '.env.production', '.env.local', '.env.production.local'] as const

let childProcess: ChildProcess | undefined
let forceKillTimer: ReturnType<typeof setTimeout> | undefined
let shuttingDown = false

const getCliPort = (): string | undefined => {
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index]
    if (argument === '-p' || argument === '--port') {
      const value = process.argv[index + 1]
      if (!value || value.startsWith('-')) {
        throw new Error(`${argument} 缺少端口值`)
      }
      return value
    }
    if (argument?.startsWith('--port=')) return argument.slice('--port='.length)
  }
  return undefined
}

const resolvePort = (): number => {
  const rawPort = getCliPort() ?? INVOCATION_ENV.PORT ?? String(DEFAULT_PORT)
  const normalizedPort = rawPort.trim()

  if (!/^\d+$/.test(normalizedPort)) {
    throw new Error(`无效端口「${rawPort}」：必须是 1-${MAX_PORT} 的整数`)
  }

  const port = Number(normalizedPort)
  if (!Number.isSafeInteger(port) || port < 1 || port > MAX_PORT) {
    throw new Error(`无效端口「${rawPort}」：必须是 1-${MAX_PORT} 的整数`)
  }

  return port
}

const shouldSkipBuild = () => process.argv.includes('--skip-build')
const shouldSkipMigrate = () => process.argv.includes('--skip-migrate')

const loadProductionEnv = () => {
  if (!existsSync(PRODUCTION_LOCAL_ENV)) {
    throw new Error(
      [
        '缺少 .env.production.local，无法进行本地生产预览。',
        '请在仓库根目录创建该文件，并填入生产 S3 / Redis / DATABASE 等密钥。',
      ].join('\n')
    )
  }

  const fileEnv: Record<string, string> = {}
  for (const file of ENV_FILES) {
    const filePath = path.join(ROOT_DIR, file)
    if (!existsSync(filePath)) continue
    loadDotenv({ path: filePath, processEnv: fileEnv, override: true, quiet: true })
  }

  Object.assign(process.env, fileEnv, INVOCATION_ENV)
}

const appendOrigin = (existing: string | undefined, origin: string) => {
  const parts = (existing ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (!parts.includes(origin)) parts.push(origin)
  return parts.join(',')
}

const applyLocalPreviewOverrides = (port: number) => {
  const origin = `http://localhost:${port}`
  process.env.PORT = String(port)
  process.env.APP_URL = origin
  process.env.ALLOWED_ORIGINS = appendOrigin(process.env.ALLOWED_ORIGINS, origin)
}

const printWarning = (port: number) => {
  console.log('')
  console.log('⚠️  本地生产预览：将使用 .env.production.local 等生产配置')
  console.log('   默认会迁移并连接生产 DB，也会连接生产 S3 / Redis。')
  console.log('   迁移和其他写操作可能影响真实数据，请确认目标环境。')
  console.log(`   预览地址：http://localhost:${port}/`)
  console.log('')
}

const ensurePortAvailable = (port: number) =>
  new Promise<void>((resolve, reject) => {
    const server = net.createServer()

    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`端口 ${port} 已被占用，请结束占用进程或使用 --port <port> 更换端口`))
        return
      }
      reject(new Error(`无法检查端口 ${port}：${error.message}`))
    })

    server.listen({ exclusive: true, host: '0.0.0.0', port }, () => {
      server.close((error) => {
        if (error) {
          reject(new Error(`释放端口 ${port} 检查套接字失败：${error.message}`))
          return
        }
        resolve()
      })
    })
  })

const spawnCommand = (command: string, args: string[], options: SpawnOptions = {}) =>
  spawn(command, args, {
    cwd: ROOT_DIR,
    detached: !isWindows,
    env: process.env,
    shell: isWindows,
    stdio: 'inherit',
    ...options,
  })

const clearForceKillTimer = () => {
  if (!forceKillTimer) return
  clearTimeout(forceKillTimer)
  forceKillTimer = undefined
}

const waitForChildExit = (child: ChildProcess) =>
  new Promise<ProcessExit>((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      if (childProcess === child) childProcess = undefined
      if (shuttingDown) clearForceKillTimer()
      callback()
    }

    child.once('error', (error) => finish(() => reject(error)))
    child.once('exit', (code, signal) => finish(() => resolve({ code, signal })))
  })

const describeCommand = (command: string, args: string[]) => [command, ...args].join(' ')

const processExitError = (label: string, result: ProcessExit) => {
  if (result.signal) return new Error(`${label} 被信号终止：${result.signal}`)
  return new Error(`${label} 已退出（exit ${result.code ?? 'null'}）`)
}

const runToCompletion = async (command: string, args: string[]) => {
  const child = spawnCommand(command, args)
  childProcess = child
  const result = await waitForChildExit(child)

  if (shuttingDown) throw new Error('ABORTED')
  if (result.signal || result.code !== 0) {
    throw processExitError(describeCommand(command, args), result)
  }
}

const sendSignal = (signal: NodeJS.Signals) => {
  if (!childProcess?.pid) return

  if (!isWindows) {
    try {
      process.kill(-childProcess.pid, signal)
      return
    } catch {
      // Fall through to the direct child pid.
    }
  }

  try {
    process.kill(childProcess.pid, signal)
  } catch {
    // Already exited.
  }
}

const shutdown = (signal: NodeJS.Signals) => {
  if (shuttingDown) {
    sendSignal('SIGKILL')
    return
  }

  shuttingDown = true
  process.exitCode = signal === 'SIGINT' ? 130 : 143
  sendSignal('SIGTERM')
  forceKillTimer = setTimeout(() => {
    forceKillTimer = undefined
    sendSignal('SIGKILL')
  }, FORCE_KILL_TIMEOUT_MS)
}

const throwIfShuttingDown = () => {
  if (shuttingDown) throw new Error('ABORTED')
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const probeHealth = async (healthUrl: string): Promise<HealthProbe | undefined> => {
  try {
    const response = await fetch(healthUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS),
    })
    let status: string | undefined

    try {
      const body: unknown = await response.json()
      if (typeof body === 'object' && body !== null && 'status' in body && typeof body.status === 'string') {
        status = body.status
      }
    } catch {
      // Any HTTP response proves that the server is accepting requests.
    }

    return { httpStatus: response.status, status }
  } catch {
    return undefined
  }
}

const waitForServerReady = async (
  healthUrl: string,
  serverExit: Promise<ProcessExit>
): Promise<HealthProbe> => {
  const startedAt = Date.now()
  const serverStopped = serverExit.then(
    (result) => ({ kind: 'exit' as const, result }),
    (error: unknown) => ({ error, kind: 'error' as const })
  )

  while (Date.now() - startedAt < READY_TIMEOUT_MS) {
    if (shuttingDown) throw new Error('ABORTED')

    const attempt = await Promise.race([
      probeHealth(healthUrl).then((health) => ({ health, kind: 'health' as const })),
      serverStopped,
    ])
    if (attempt.kind === 'error') throw attempt.error
    if (attempt.kind === 'exit') throw processExitError('next start', attempt.result)
    if (attempt.health) return attempt.health

    const retry = await Promise.race([wait(READY_RETRY_MS).then(() => undefined), serverStopped])
    if (retry?.kind === 'error') throw retry.error
    if (retry?.kind === 'exit') throw processExitError('next start', retry.result)
  }

  throw new Error(`next start 在 ${READY_TIMEOUT_MS / 1000} 秒内未响应：${healthUrl}`)
}

const stopActiveChild = async (serverExit: Promise<ProcessExit>) => {
  sendSignal('SIGTERM')
  const stopped = await Promise.race([
    serverExit.then(
      () => true,
      () => true
    ),
    wait(FORCE_KILL_TIMEOUT_MS).then(() => false),
  ])
  if (!stopped) sendSignal('SIGKILL')
}

const printReady = (rootUrl: string, health: HealthProbe) => {
  console.log('')
  if (health.httpStatus === 200 && health.status === 'ok') {
    console.log('✅ 服务已就绪，数据库健康检查通过')
  } else {
    const reportedStatus = health.status ? `，status=${health.status}` : ''
    console.warn(`⚠️  服务已启动，但健康检查需要关注（HTTP ${health.httpStatus}${reportedStatus}）`)
  }
  console.log(`🌐 访问地址：${rootUrl}`)
  console.log('')
}

const main = async () => {
  loadProductionEnv()

  const port = resolvePort()
  applyLocalPreviewOverrides(port)

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as NodeJS.Signals[]) {
    process.on(signal, () => shutdown(signal))
  }

  process.on('exit', () => {
    sendSignal('SIGKILL')
  })

  printWarning(port)
  console.log(`🔎 检查端口 ${port} …`)
  await ensurePortAvailable(port)
  throwIfShuttingDown()
  console.log('✅ 端口可用')

  if (!shouldSkipBuild()) {
    console.log('📦 开始生产构建（pnpm run build）…')
    await runToCompletion('pnpm', ['run', 'build'])
    console.log('✅ 构建完成')
  } else {
    console.log('⏭️  跳过构建（--skip-build）')
  }

  if (!existsSync(BUILD_ID_FILE)) {
    throw new Error('未找到 .next/BUILD_ID；请移除 --skip-build 重新构建，或先运行 pnpm build')
  }
  throwIfShuttingDown()
  console.log('✅ Next 生产构建产物有效（.next/BUILD_ID）')

  if (!shouldSkipMigrate()) {
    console.log('🗄️  启动前执行数据库迁移（pnpm run db:migrate）…')
    await runToCompletion('pnpm', ['run', 'db:migrate'])
    console.log('✅ 数据库迁移完成')
  } else {
    console.warn('⏭️  跳过数据库迁移（--skip-migrate）；请确认目标数据库已与当前代码同步')
  }

  const rootUrl = `http://localhost:${port}/`
  const healthUrl = new URL('/api/health', rootUrl).href
  console.log(`🚀 启动 next start -p ${port} …`)
  const server = spawnCommand('pnpm', ['exec', 'next', 'start', '-p', String(port)])
  childProcess = server
  const serverExit = waitForChildExit(server)

  let health: HealthProbe
  try {
    health = await waitForServerReady(healthUrl, serverExit)
  } catch (error) {
    await stopActiveChild(serverExit)
    throw error
  }

  printReady(rootUrl, health)

  const result = await serverExit
  if (shuttingDown) return
  if (result.signal || result.code !== 0) throw processExitError('next start', result)
}

const isMainModule = () => {
  const entry = process.argv[1]
  return !!entry && import.meta.url === pathToFileURL(path.resolve(entry)).href
}

if (isMainModule()) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'ABORTED' || shuttingDown) {
      process.exit(process.exitCode ?? 1)
    }
    console.error('❌ 本地生产预览失败:', message)
    process.exit(1)
  })
}
