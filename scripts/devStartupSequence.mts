/**
 * 本地开发启动编排：并发拉起 Next（API / BFF）与 Vite SPA。
 *
 * ## 用途
 * - 由 `pnpm dev` / `bun run dev` 调用（见 package.json `dev`）
 * - 加载 `.env` → `.env.local`（后者覆盖）
 * - 启动 `next dev`，再启动 `dev:spa`（Vite，默认 5174，`/api` 代理到 Next）
 * - 任一子进程异常退出时，优雅结束另一进程；Ctrl+C 发 SIGTERM，超时后 SIGKILL
 *
 * ## 使用
 * ```bash
 * pnpm dev                 # 推荐：Next :3000 + SPA :5174
 * pnpm dev:inspect         # 同上，并启用 code-inspector（CODE_INSPECTOR=1）
 * pnpm dev -- -p 3001      # 自定义 Next 端口（`-p` > PORT > 3000）
 * PORT=3001 pnpm dev       # 等价：用环境变量指定 Next 端口
 * ```
 *
 * ## 访问
 * - UI：http://localhost:5174/ （请用 SPA 端口，不要依赖 Debug Proxy）
 * - API：http://localhost:<next-port>/ （默认 3000）
 *
 * ## 仅启动其一
 * ```bash
 * pnpm dev:next            # 仅 Next
 * pnpm dev:spa             # 仅 Vite SPA（需本机已有 Next 或可连的 API）
 * CODE_INSPECTOR=1 pnpm dev:spa  # 仅 SPA 且开启 code-inspector
 * ```
 *
 * ## 前置
 * - 包管理：pnpm；本脚本用 bun 拉起子进程（需本机安装 bun）
 * - 环境变量：根目录 `.env.local`（参考 docs/quick-start.zh-CN.md）
 *
 * 生产预览请用 `pnpm build && pnpm start`（:3210），不要走本脚本。
 */

import type { ChildProcess, SpawnOptions } from 'node:child_process'
import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { config as loadDotenv } from 'dotenv'

interface DevProcessHandle {
  directPid?: number
  groupPid?: number
  isWindows: boolean
}

const isWindows = process.platform === 'win32'
const NEXT_HOST = 'localhost'
const NEXT_READY_TIMEOUT_MS = 180_000
const NEXT_READY_RETRY_MS = 400
const FORCE_KILL_TIMEOUT_MS = 5_000
const packageScriptCommand = 'bun'

/**
 * Resolve the Next.js dev port.
 * Priority: -p CLI flag > PORT env var > 3000.
 */
const resolveNextPort = (): number => {
  const pIndex = process.argv.indexOf('-p')
  if (pIndex !== -1 && process.argv[pIndex + 1]) {
    return Number(process.argv[pIndex + 1])
  }
  if (process.env.PORT) return Number(process.env.PORT)
  return 3000
}

let nextPort = 3000
let nextRootUrl = `http://${NEXT_HOST}:${nextPort}/`
let nextProcess: ChildProcess | undefined
let viteProcess: ChildProcess | undefined
let nextHandle: DevProcessHandle | undefined
let viteHandle: DevProcessHandle | undefined
let forceKillTimer: ReturnType<typeof setTimeout> | undefined
let shuttingDown = false

const createPackageScriptProcessConfig = ({
  isWindows,
  scriptName,
}: {
  isWindows: boolean
  scriptName: string
}): { args: string[]; command: string; options: SpawnOptions } => ({
  args: ['run', scriptName],
  command: packageScriptCommand,
  options: {
    detached: !isWindows,
    env: process.env,
    shell: isWindows,
    stdio: 'inherit',
  },
})

const runPackageScript = (scriptName: string) => {
  const { args, command, options } = createPackageScriptProcessConfig({ isWindows, scriptName })
  return spawn(command, args, options)
}

const loadEnv = () => {
  loadDotenv({ path: '.env' })
  loadDotenv({ path: '.env.local', override: true })
}

const createDevProcessHandle = ({
  isWindows,
  pid,
}: {
  isWindows: boolean
  pid?: number
}): DevProcessHandle => ({
  directPid: pid,
  groupPid: isWindows ? undefined : pid,
  isWindows,
})

const sendSignalToDevProcess = (handle: DevProcessHandle | undefined, signal: NodeJS.Signals) => {
  if (!handle) return

  if (!handle.isWindows && handle.groupPid) {
    try {
      process.kill(-handle.groupPid, signal)
      return
    } catch {
      // Fall through to the direct child pid.
    }
  }

  if (!handle.directPid) return

  try {
    process.kill(handle.directPid, signal)
  } catch {
    // Already exited.
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isPortOpen = (host: string, port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port })
    const onDone = (result: boolean) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(result)
    }

    socket.once('connect', () => onDone(true))
    socket.once('error', () => onDone(false))
    socket.setTimeout(1_000, () => onDone(false))
  })

const waitForNextReady = async () => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < NEXT_READY_TIMEOUT_MS) {
    if (await isPortOpen(NEXT_HOST, nextPort)) return
    await wait(NEXT_READY_RETRY_MS)
  }

  throw new Error(
    `Next server was not ready within ${NEXT_READY_TIMEOUT_MS / 1000}s on ${NEXT_HOST}:${nextPort}`,
  )
}

const terminateChildren = () => {
  sendSignalToDevProcess(viteHandle, 'SIGTERM')
  sendSignalToDevProcess(nextHandle, 'SIGTERM')
}

const forceKillChildren = () => {
  sendSignalToDevProcess(viteHandle, 'SIGKILL')
  sendSignalToDevProcess(nextHandle, 'SIGKILL')
}

const clearForceKillTimer = () => {
  if (!forceKillTimer) return
  clearTimeout(forceKillTimer)
  forceKillTimer = undefined
}

const hasChildSettled = (child?: ChildProcess) =>
  !child || child.exitCode !== null || child.signalCode !== null

const clearForceKillTimerWhenChildrenSettle = () => {
  if (!shuttingDown) return
  if (hasChildSettled(nextProcess) && hasChildSettled(viteProcess)) clearForceKillTimer()
}

const shutdownAll = (signal: NodeJS.Signals) => {
  if (shuttingDown) {
    forceKillChildren()
    return
  }
  shuttingDown = true

  terminateChildren()
  process.exitCode = signal === 'SIGINT' ? 130 : 143

  forceKillTimer = setTimeout(() => {
    forceKillTimer = undefined
    forceKillChildren()
  }, FORCE_KILL_TIMEOUT_MS)
}

const watchChildExit = (child: ChildProcess, name: 'next' | 'vite') => {
  child.once('exit', (code, signal) => {
    if (shuttingDown) {
      clearForceKillTimerWhenChildrenSettle()
      return
    }

    console.error(
      `❌ ${name} exited unexpectedly (code: ${code ?? 'null'}, signal: ${signal ?? 'null'})`,
    )
    shutdownAll('SIGTERM')
  })
}

const runNextBackgroundTasks = () => {
  setTimeout(() => {
    console.log(`🔁 Next API: ${nextRootUrl}`)
    console.log(`🔁 SPA:      http://localhost:5174/`)
  }, 2_000)

  void (async () => {
    try {
      await waitForNextReady()
      console.log(`✅ Next ready on ${NEXT_HOST}:${nextPort}`)
    } catch (error) {
      console.warn('⚠️ Next ready check failed:', error)
    }
  })()
}

const main = async () => {
  loadEnv()
  nextPort = resolveNextPort()
  nextRootUrl = `http://${NEXT_HOST}:${nextPort}/`

  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as NodeJS.Signals[]) {
    process.on(sig, () => shutdownAll(sig))
  }

  process.on('uncaughtException', (error) => {
    console.error('❌ uncaught exception in dev startup:', error)
    shutdownAll('SIGTERM')
  })

  process.on('unhandledRejection', (reason) => {
    console.error('❌ unhandled rejection in dev startup:', reason)
    shutdownAll('SIGTERM')
  })

  process.on('exit', () => {
    forceKillChildren()
  })

  nextProcess = spawn('bunx', ['next', 'dev', '-p', String(nextPort)], {
    detached: !isWindows,
    env: process.env,
    shell: isWindows,
    stdio: 'inherit',
  })
  nextHandle = createDevProcessHandle({ isWindows, pid: nextProcess.pid })
  watchChildExit(nextProcess, 'next')

  viteProcess = runPackageScript('dev:spa')
  viteHandle = createDevProcessHandle({ isWindows, pid: viteProcess.pid })
  watchChildExit(viteProcess, 'vite')
  runNextBackgroundTasks()

  await Promise.race([
    new Promise((resolve) => nextProcess?.once('exit', resolve)),
    new Promise((resolve) => viteProcess?.once('exit', resolve)),
  ])
}

const isMainModule = () => {
  const entry = process.argv[1]
  return !!entry && import.meta.url === pathToFileURL(path.resolve(entry)).href
}

if (isMainModule()) {
  void main().catch((error) => {
    console.error('❌ dev startup sequence failed:', error)
    shutdownAll('SIGTERM')
  })
}
