/**
 * 本地生产预览：用生产环境变量跑完整 build + next start（同域 SPA + API）。
 *
 * ## 用途
 * - 由 `pnpm preview:prod` 调用
 * - Env 加载顺序（后者覆盖前者，对齐 Next production）：
 *   `.env` → `.env.production` → `.env.local` → `.env.production.local`
 * - 强制覆写本地可访问地址：`APP_URL=http://localhost:<port>`，并确保 `ALLOWED_ORIGINS` 含该 origin
 * - 默认端口 `3210`（与 `pnpm start` 一致）
 *
 * ## 使用
 * ```bash
 * pnpm preview:prod                    # build + start
 * pnpm preview:prod -- --skip-build    # 跳过构建，仅启动
 * pnpm preview:prod -- -p 3211         # 自定义端口
 * PORT=3211 pnpm preview:prod          # 等价
 * ```
 *
 * ## 访问
 * - UI + API（同域）：http://localhost:3210/
 *
 * ## 注意
 * - 需要本机 bun；`.env.production.local` 必须存在
 * - 会连接生产 DB / S3 / Redis，写操作会影响真实数据
 * - 本地 `build:spa:copy` 会改写 `spaHtmlTemplate.generated.ts`，勿提交构建产物
 */

import type { ChildProcess, SpawnOptions } from 'node:child_process'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { config as loadDotenv } from 'dotenv'

const isWindows = process.platform === 'win32'
const DEFAULT_PORT = 3210
const FORCE_KILL_TIMEOUT_MS = 5_000
const ROOT_DIR = process.cwd()
const PRODUCTION_LOCAL_ENV = path.join(ROOT_DIR, '.env.production.local')

const ENV_FILES = ['.env', '.env.production', '.env.local', '.env.production.local'] as const

let childProcess: ChildProcess | undefined
let forceKillTimer: ReturnType<typeof setTimeout> | undefined
let shuttingDown = false

const resolvePort = (): number => {
  const pIndex = process.argv.indexOf('-p')
  if (pIndex !== -1 && process.argv[pIndex + 1]) {
    return Number(process.argv[pIndex + 1])
  }
  if (process.env.PORT) return Number(process.env.PORT)
  return DEFAULT_PORT
}

const shouldSkipBuild = () => process.argv.includes('--skip-build')

const loadProductionEnv = () => {
  if (!existsSync(PRODUCTION_LOCAL_ENV)) {
    console.error('❌ 缺少 .env.production.local，无法进行本地生产预览。')
    console.error('   请在仓库根目录创建该文件，并填入生产 S3 / Redis / DATABASE 等密钥。')
    process.exit(1)
  }

  for (const file of ENV_FILES) {
    const filePath = path.join(ROOT_DIR, file)
    if (!existsSync(filePath)) continue
    loadDotenv({ path: filePath, override: true })
  }
}

const appendOrigin = (existing: string | undefined, origin: string) => {
  const parts = (existing ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!parts.includes(origin)) parts.push(origin)
  return parts.join(',')
}

const applyLocalPreviewOverrides = (port: number) => {
  const origin = `http://localhost:${port}`
  process.env.PORT = String(port)
  // 模拟 Vercel 环境
  // process.env.VERCEL = '1'
  process.env.APP_URL = origin
  process.env.ALLOWED_ORIGINS = appendOrigin(process.env.ALLOWED_ORIGINS, origin)
}

const printWarning = (port: number) => {
  console.log('')
  console.log('⚠️  本地生产预览：将使用 .env.production.local 等生产配置')
  console.log('   会连接生产 DB / S3 / Redis，写操作会影响真实数据。')
  console.log(`   预览地址：http://localhost:${port}/`)
  console.log('')
}

const spawnCommand = (command: string, args: string[], options: SpawnOptions = {}) =>
  spawn(command, args, {
    cwd: ROOT_DIR,
    env: process.env,
    shell: isWindows,
    stdio: 'inherit',
    ...options,
  })

const runToCompletion = (command: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawnCommand(command, args)
    childProcess = child

    child.once('error', (error) => {
      childProcess = undefined
      reject(error)
    })

    child.once('exit', (code, signal) => {
      childProcess = undefined
      if (shuttingDown) {
        reject(new Error('ABORTED'))
        return
      }
      if (signal) {
        reject(new Error(`${command} 被信号终止: ${signal}`))
        return
      }
      if (code !== 0) {
        reject(new Error(`${command} ${args.join(' ')} 失败（exit ${code ?? 'null'}）`))
        return
      }
      resolve()
    })
  })

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

const clearForceKillTimer = () => {
  if (!forceKillTimer) return
  clearTimeout(forceKillTimer)
  forceKillTimer = undefined
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

const waitForChildExit = (child: ChildProcess) =>
  new Promise<number | null>((resolve) => {
    child.once('exit', (code) => {
      clearForceKillTimer()
      resolve(code)
    })
  })

const main = async () => {
  loadProductionEnv()

  const port = resolvePort()
  if (!Number.isFinite(port) || port <= 0) {
    console.error('❌ 无效端口，请使用 -p <port> 或 PORT=<port>')
    process.exit(1)
  }

  applyLocalPreviewOverrides(port)
  printWarning(port)

  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as NodeJS.Signals[]) {
    process.on(sig, () => shutdown(sig))
  }

  process.on('exit', () => {
    sendSignal('SIGKILL')
  })

  if (!shouldSkipBuild()) {
    console.log('📦 开始生产构建（pnpm build）…')
    await runToCompletion('pnpm', ['run', 'build'])
    if (shuttingDown) return
    console.log('✅ 构建完成')
  } else {
    console.log('⏭️  跳过构建（--skip-build）')
  }

  console.log(`🚀 启动 next start -p ${port} …`)
  const server = spawnCommand('pnpm', ['exec', 'next', 'start', '-p', String(port)], {
    detached: !isWindows,
  })
  childProcess = server

  server.once('error', (error) => {
    console.error('❌ 启动 next start 失败:', error)
    process.exitCode = 1
  })

  const code = await waitForChildExit(server)
  if (!shuttingDown && code !== 0 && code !== null) {
    process.exitCode = code
  }
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
    console.error('❌ 本地生产预览失败:', error)
    process.exit(1)
  })
}
