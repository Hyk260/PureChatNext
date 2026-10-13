import { execFile, execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import net from 'node:net'
import { homedir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { parse } from 'dotenv'

import {
  collectAncestorPids,
  collectKillTargets,
  collectStaleDesktopProcesses,
  isElectronAppCommand,
  isStaleDesktopCommand,
  parsePsTable,
  type ProcessRow,
} from './lib/desktop-process'

const execFileAsync = promisify(execFile)
const isWindows = process.platform === 'win32'
const rootDir = process.cwd()
const desktopEnvPath = path.resolve(rootDir, 'apps/desktop/.env.desktop')
const desktopEnvLocalPath = path.resolve(rootDir, 'apps/desktop/.env.desktop.local')

/** Cursor/VS Code 点「重启任务」时，旧进程与新进程会交错；必须先杀干净再启动。 */
const STALE_KILL_ROUNDS = 25
const STALE_KILL_INTERVAL_MS = 80
const PORT_FREE_WAIT_MS = 2_000
const ELECTRON_READY_WAIT_MS = 12_000
const MAX_ELECTRON_START_ATTEMPTS = 2
const SHUTDOWN_WAIT_MS = 1_500
const ELECTRON_SINGLETON_NAMES = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'] as const

const readEnvFile = (filePath: string) => {
  try {
    return parse(readFileSync(filePath))
  } catch {
    return {}
  }
}

const desktopEnv = {
  ...readEnvFile(desktopEnvPath),
  ...readEnvFile(desktopEnvLocalPath),
  ...process.env,
}

const nextPort = Number(desktopEnv.PORT) || 3000
const rendererPort = Number(desktopEnv.PURECHAT_DESKTOP_VITE_PORT) || 5176
const desktopProcessEnv = {
  ...desktopEnv,
  APP_URL: desktopEnv.APP_URL || `http://localhost:${nextPort}`,
  PORT: String(nextPort),
  PURECHAT_DESKTOP_VITE_PORT: String(rendererPort),
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const spawnProcess = (command: string, args: string[]) =>
  spawn(command, args, {
    cwd: rootDir,
    // Unix 下独立进程组，任务复用/Ctrl+C 时可整树结束，避免 Electron 孤儿写坏掉的 stdout → write EIO
    detached: !isWindows,
    env: desktopProcessEnv,
    shell: isWindows,
    stdio: 'inherit',
  })

/**
 * Windows 下结束整棵进程树。
 * shell:true 拉起的子进程外壳是 cmd.exe，直接 kill 只会结束外壳，
 * pnpm / electron-vite / Electron 会全部成为孤儿，重试时 renderer 端口仍被占用。
 */
const killWindowsTree = (pid: number, force: boolean) => {
  try {
    execFileSync('taskkill.exe', ['/PID', String(pid), '/T', ...(force ? ['/F'] : [])], {
      stdio: 'ignore',
      windowsHide: true,
    })
  } catch {
    // 进程已退出、无权限或 PID 已被复用，交给下一轮检查兜底。
  }
}

const stopProcess = (child: ChildProcess | undefined, signal: NodeJS.Signals = 'SIGTERM') => {
  if (!child?.pid) return

  if (isWindows) {
    killWindowsTree(child.pid, signal !== 'SIGTERM')
    return
  }

  try {
    process.kill(-child.pid, signal)
    return
  } catch {
    // Fall through to the direct child pid.
  }

  if (!child.killed) {
    try {
      child.kill(signal)
    } catch {
      // Already exited.
    }
  }
}

const waitForExit = (child: ChildProcess) =>
  new Promise<number>((resolve) => {
    if (child.exitCode !== null) {
      resolve(child.exitCode)
      return
    }
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)))
  })

const waitForPort = (port: number, timeoutMs = 180_000, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    let timer: ReturnType<typeof setTimeout> | undefined
    let socket: net.Socket | undefined
    let settled = false

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      socket?.destroy()
      signal?.removeEventListener('abort', onAbort)
      if (error) reject(error)
      else resolve()
    }

    const onAbort = () => finish(new Error('端口等待已取消'))

    const scheduleProbe = () => {
      if (settled) return
      if (signal?.aborted) {
        onAbort()
        return
      }
      if (Date.now() >= deadline) {
        finish(new Error(`等待端口 ${port} 超时`))
        return
      }
      timer = setTimeout(probe, 400)
    }

    const probe = () => {
      if (settled) return
      const currentSocket = net.createConnection({ host: '127.0.0.1', port })
      socket = currentSocket
      let retried = false
      const retry = () => {
        if (retried) return
        retried = true
        currentSocket.destroy()
        scheduleProbe()
      }

      currentSocket.once('connect', finish)
      currentSocket.once('error', retry)
      currentSocket.setTimeout(Math.min(1_000, Math.max(1, deadline - Date.now())), retry)
    }

    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    probe()
  })

const isPortOpen = (port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    const finish = (result: boolean) => {
      socket.destroy()
      resolve(result)
    }
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.setTimeout(1_000, () => finish(false))
  })

const runPowerShell = async (script: string, timeout: number, signal?: AbortSignal) => {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { timeout, maxBuffer: 32 * 1024 * 1024, signal, windowsHide: true }
  )
  return stdout
}

const listListeningPids = async (port: number): Promise<number[]> => {
  try {
    if (isWindows) {
      const stdout = await runPowerShell(
        `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`,
        5_000
      )
      return [
        ...new Set(
          stdout
            .trim()
            .split(/\r?\n/)
            .map((line) => Number(line.trim()))
            .filter((pid) => Number.isInteger(pid) && pid > 0)
        ),
      ]
    }

    const { stdout } = await execFileAsync('lsof', ['-t', '-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
      timeout: 2_000,
    })
    return [...new Set(stdout.trim().split('\n').map((line) => Number(line)).filter((pid) => Number.isInteger(pid) && pid > 0))]
  } catch {
    return []
  }
}

const signalPid = (pid: number, signal: NodeJS.Signals) => {
  if (isWindows) {
    killWindowsTree(pid, signal !== 'SIGTERM')
    return
  }

  try {
    process.kill(pid, signal)
  } catch {
    // Already exited.
  }
}

/** 结束占用桌面 renderer 端口的旧进程，避免任务复用后端口冲突 / 孤儿 Electron */
const freeRendererPort = async (port: number) => {
  let pids = await listListeningPids(port)
  if (pids.length === 0) return

  console.log(`Clearing previous desktop renderer on port ${port} (PID ${pids.join(', ')})`)
  for (const pid of pids) signalPid(pid, 'SIGTERM')

  const deadline = Date.now() + PORT_FREE_WAIT_MS
  while (Date.now() < deadline) {
    await wait(200)
    pids = await listListeningPids(port)
    if (pids.length === 0) return
  }

  console.log(`Force-killing desktop renderer on port ${port} (PID ${pids.join(', ')})`)
  for (const pid of pids) signalPid(pid, 'SIGKILL')
  await wait(200)
}

type WindowsCimProcess = { CommandLine?: unknown; ParentProcessId?: unknown; ProcessId?: unknown }

const listProcessRowsWindows = async (electronOnly: boolean, signal?: AbortSignal): Promise<ProcessRow[]> => {
  // Windows 没有 ps：用 CIM 读取 PID/PPID/命令行。就绪检测只需 electron.exe，加过滤可显著提速。
  const script =
    `Get-CimInstance Win32_Process${electronOnly ? " -Filter \"Name='electron.exe'\"" : ''} | ` +
    'Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress'

  try {
    const stdout = (await runPowerShell(script, 6_000, signal)).trim()
    if (!stdout) return []
    const parsed = JSON.parse(stdout) as WindowsCimProcess | WindowsCimProcess[]
    const items = Array.isArray(parsed) ? parsed : [parsed]

    return items.flatMap((item): ProcessRow[] => {
      const pid = Number(item.ProcessId)
      const ppid = Number(item.ParentProcessId)
      if (!Number.isInteger(pid) || pid <= 0) return []
      return [
        {
          command: typeof item.CommandLine === 'string' ? item.CommandLine.replaceAll(/[\r\n\t]+/g, ' ').trim() : '',
          pgid: pid, // Windows 无进程组概念，以自身 pid 占位；组杀分支不会在 Windows 使用。
          pid,
          ppid: Number.isInteger(ppid) ? ppid : 0,
          state: 'R', // CIM 枚举到的都是存活进程。
        },
      ]
    })
  } catch {
    return []
  }
}

const listProcessRows = async (electronOnly = false, signal?: AbortSignal): Promise<ProcessRow[]> => {
  if (isWindows) return listProcessRowsWindows(electronOnly, signal)

  try {
    const { stdout } = await execFileAsync('ps', ['-axww', '-o', 'pid=,ppid=,pgid=,state=,command='], {
      env: { ...process.env, COLUMNS: '512' },
      signal,
      timeout: 3_000,
    })
    return parsePsTable(stdout)
  } catch {
    return []
  }
}

/** electron-vite 拉起的 Electron 主进程命令行是 `.../electron.exe .`，不含项目路径，沿父链上溯时需额外识别。 */
const isWindowsToolchainAncestor = (command: string) => {
  const normalizedCommand = command.replaceAll('\\', '/')
  return isStaleDesktopCommand(command, rootDir) || /[\\/]electron(?:\.exe)?\s+\.\s*$/i.test(normalizedCommand)
}

/**
 * Windows 版残留进程收集：从命中的行沿 PPID 上溯到工具链树的根
 *（pnpm/cmd → electron-vite → electron.exe .），后续用 taskkill /T 整树结束。
 */
const collectWindowsStaleRoots = (rows: readonly ProcessRow[], protectedPids: ReadonlySet<number>): ProcessRow[] => {
  const byPid = new Map(rows.map((row) => [row.pid, row]))
  const roots = new Map<number, ProcessRow>()

  for (const row of rows) {
    if (protectedPids.has(row.pid) || !isStaleDesktopCommand(row.command, rootDir)) continue

    let root = row
    let parent = byPid.get(root.ppid)
    while (parent && !protectedPids.has(parent.pid) && isWindowsToolchainAncestor(parent.command)) {
      root = parent
      parent = byPid.get(root.ppid)
    }
    roots.set(root.pid, root)
  }

  return [...roots.values()]
}

const inspectDesktopProcesses = async () => {
  const rows = await listProcessRows(false)
  const selfRow = rows.find((row) => row.pid === process.pid)
  const protectedPids = collectAncestorPids(rows, process.pid)
  if (selfRow) protectedPids.add(selfRow.pgid)
  protectedPids.add(process.pid)
  if (process.ppid) protectedPids.add(process.ppid)
  return {
    protectedPids,
    stale: isWindows
      ? collectWindowsStaleRoots(rows, protectedPids)
      : collectStaleDesktopProcesses(rows, { protectedPids, rootDir }),
  }
}

/** 仅 Electron 应用进程（不含 electron-vite），用于判断窗口是否真正拉起 */
const listElectronAppPids = async (signal?: AbortSignal): Promise<number[]> => {
  const rows = await listProcessRows(true, signal)
  return rows.filter((row) => isElectronAppCommand(row.command, rootDir)).map((row) => row.pid)
}

const formatStaleProcess = (row: ProcessRow) => `${row.pid} (${row.command.slice(0, 80)})`

const clearElectronSingletonLocks = async () => {
  if (isWindows) return

  const home = homedir()
  const candidates = [
    path.join(home, 'Library/Application Support/purechat-desktop-dev'),
    path.join(home, 'Library/Application Support/Electron'),
  ]

  for (const dir of candidates) {
    await Promise.all(
      ELECTRON_SINGLETON_NAMES.map((name) => rm(path.join(dir, name), { force: true }).catch(() => undefined))
    )
  }
}

const signalGroup = (pgid: number, signal: NodeJS.Signals) => {
  // Windows 无进程组语义，残留进程统一走 taskkill /T 整树结束。
  if (isWindows) return

  try {
    process.kill(-pgid, signal)
  } catch {
    // Already exited, or this process is not allowed to signal the group.
  }
}

/**
 * 清掉上次未退出的 Electron / electron-vite。
 * 必须 SIGKILL 整棵进程树：SIGTERM 会给 electron-vite 机会重启主进程，留下白屏旧窗。
 */
const killStaleDesktopProcesses = async () => {
  let logged = false

  for (let round = 0; round < STALE_KILL_ROUNDS; round++) {
    const { protectedPids, stale } = await inspectDesktopProcesses()
    if (stale.length === 0) return

    if (!logged) {
      console.log(`Stopping leftover desktop processes (PID ${stale.map((row) => row.pid).join(', ')})`)
      logged = true
    }

    if (isWindows) {
      // stale 已收敛为各工具链树的根，/T 连带结束 pnpm → electron-vite → Electron 全部子进程。
      for (const row of stale) killWindowsTree(row.pid, true)
    } else {
      const { pgids, pids } = collectKillTargets(stale, protectedPids)
      for (const pgid of pgids) signalGroup(pgid, 'SIGKILL')
      for (const pid of pids) signalPid(pid, 'SIGKILL')
    }
    await wait(STALE_KILL_INTERVAL_MS)
  }

  const remaining = (await inspectDesktopProcesses()).stale
  if (remaining.length === 0) return

  throw new Error(`无法结束残留桌面进程: ${remaining.map(formatStaleProcess).join('; ')}`)
}

/** 重启前确保旧 Electron 与 renderer 端口都已退出，释放单实例锁 */
const prepareCleanDesktopStart = async () => {
  await killStaleDesktopProcesses()
  if (await isPortOpen(rendererPort)) {
    await freeRendererPort(rendererPort)

    const portDeadline = Date.now() + PORT_FREE_WAIT_MS
    while (Date.now() < portDeadline && (await isPortOpen(rendererPort))) {
      await wait(200)
    }
  }
  await clearElectronSingletonLocks()
}

const waitForElectronApp = async (
  timeoutMs: number,
  existingPids: ReadonlySet<number>,
  signal?: AbortSignal
) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (signal?.aborted) return false
    const pids = await listElectronAppPids(signal)
    if (pids.some((pid) => !existingPids.has(pid))) return true
    await wait(300)
  }
  return false
}

const waitForElectronReady = async (
  timeoutMs: number,
  existingPids: ReadonlySet<number>,
  signal: AbortSignal
) => {
  const [rendererReady, electronReady] = await Promise.all([
    waitForPort(rendererPort, timeoutMs, signal)
      .then(() => true)
      .catch(() => false),
    waitForElectronApp(timeoutMs, existingPids, signal),
  ])

  if (!rendererReady) return { kind: 'no-renderer' as const }
  if (!electronReady) return { kind: 'no-app' as const }
  return { kind: 'ready' as const }
}

const startElectronDev = async (
  track: (child: ChildProcess | undefined) => void,
  isCancelled: () => boolean
) => {
  const assertRunning = (child?: ChildProcess) => {
    if (!isCancelled()) return
    if (child) stopProcess(child, 'SIGKILL')
    track(undefined)
    throw new Error('Desktop startup cancelled')
  }

  for (let attempt = 1; attempt <= MAX_ELECTRON_START_ATTEMPTS; attempt++) {
    assertRunning()
    if (attempt > 1) {
      console.log(`Retrying Electron desktop start (attempt ${attempt}/${MAX_ELECTRON_START_ATTEMPTS})...`)
      await prepareCleanDesktopStart()
      assertRunning()
    }

    const existingAppPids = new Set(await listElectronAppPids())
    console.log(`Starting Electron renderer on http://127.0.0.1:${rendererPort}`)
    const child = spawnProcess('pnpm', ['--dir', 'apps/desktop', 'dev'])
    assertRunning(child)
    track(child)

    const readinessController = new AbortController()
    let result: { kind: 'exit'; code: number } | { kind: 'ready' | 'no-app' | 'no-renderer' }
    try {
      result = await Promise.race([
        waitForExit(child).then((code) => ({ kind: 'exit' as const, code })),
        waitForElectronReady(ELECTRON_READY_WAIT_MS, existingAppPids, readinessController.signal),
      ])
    } finally {
      readinessController.abort()
    }

    assertRunning(child)
    if (result.kind === 'ready') return child

    const reason =
      result.kind === 'exit'
        ? `process exited (code ${result.code})`
        : result.kind === 'no-renderer'
          ? `renderer port ${rendererPort} did not open`
          : 'Electron app process did not appear (possible single-instance lock)'

    console.warn(
      `Electron desktop start failed on attempt ${attempt}: ${reason}. ` +
        'Usually caused by a leftover process or lock after task restart.'
    )
    stopProcess(child, 'SIGKILL')
    track(undefined)
    await killStaleDesktopProcesses()
    await clearElectronSingletonLocks()
    await wait(300)

    if (attempt === MAX_ELECTRON_START_ATTEMPTS) {
      throw new Error('Electron desktop failed to stay running after restart cleanup')
    }
  }

  throw new Error('Electron desktop failed to start')
}

const main = async () => {
  let nextProcess: ChildProcess | undefined
  let electronProcess: ChildProcess | undefined
  let shuttingDown = false

  const cleanup = async () => {
    if (shuttingDown) return
    shuttingDown = true
    // 只结束本会话拉起的进程组。不要全局 pgrep，否则任务重启时会误杀新实例。
    stopProcess(electronProcess, 'SIGKILL')
    stopProcess(nextProcess)

    await Promise.race([
      Promise.all([
        electronProcess ? waitForExit(electronProcess) : Promise.resolve(0),
        nextProcess ? waitForExit(nextProcess) : Promise.resolve(0),
      ]),
      wait(SHUTDOWN_WAIT_MS),
    ])

    stopProcess(electronProcess, 'SIGKILL')
    stopProcess(nextProcess, 'SIGKILL')
  }

  const handleSignal = () => {
    cleanup().finally(() => {
      process.exit(0)
    })
  }

  process.once('SIGINT', handleSignal)
  process.once('SIGTERM', handleSignal)

  try {
    await prepareCleanDesktopStart()

    if (await isPortOpen(nextPort)) {
      console.log(`Reusing shared Next.js BFF at http://localhost:${nextPort}`)
    } else {
      console.log(`Starting shared Next.js BFF on http://localhost:${nextPort}`)
      nextProcess = spawnProcess('bun', ['run', 'dev:next', '--', '-p', String(nextPort)])
    }
    await waitForPort(nextPort)

    electronProcess = await startElectronDev((child) => {
      electronProcess = child
    }, () => shuttingDown)

    const exitPromises = [waitForExit(electronProcess)]
    if (nextProcess) exitPromises.push(waitForExit(nextProcess))
    const exitCode = await Promise.race(exitPromises)
    await cleanup()
    process.exitCode = exitCode
  } catch (error) {
    await cleanup()
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

main()
