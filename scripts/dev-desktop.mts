import { execFile, spawn, type ChildProcess } from 'node:child_process'
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

const stopProcess = (child: ChildProcess | undefined, signal: NodeJS.Signals = 'SIGTERM') => {
  if (!child?.pid) return

  if (!isWindows) {
    try {
      process.kill(-child.pid, signal)
      return
    } catch {
      // Fall through to the direct child pid.
    }
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

const waitForPort = (port: number, timeoutMs = 180_000) =>
  new Promise<void>((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    let timer: ReturnType<typeof setTimeout> | undefined

    const probe = () => {
      const socket = net.createConnection({ host: '127.0.0.1', port })
      const finish = (error?: Error) => {
        socket.destroy()
        if (timer) clearTimeout(timer)
        if (error) reject(error)
        else resolve()
      }

      socket.once('connect', () => finish())
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() >= deadline) {
          reject(new Error(`等待 Next.js 端口 ${port} 超时`))
          return
        }
        timer = setTimeout(probe, 400)
      })
    }

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

const listListeningPids = async (port: number): Promise<number[]> => {
  if (isWindows) return []

  try {
    const { stdout } = await execFileAsync('lsof', ['-t', '-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
      timeout: 2_000,
    })
    return [...new Set(stdout.trim().split('\n').map((line) => Number(line)).filter((pid) => Number.isInteger(pid) && pid > 0))]
  } catch {
    return []
  }
}

const signalPid = (pid: number, signal: NodeJS.Signals) => {
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

const listProcessRows = async (): Promise<ProcessRow[]> => {
  if (isWindows) return []

  try {
    const { stdout } = await execFileAsync('ps', ['-axww', '-o', 'pid=,ppid=,pgid=,state=,command='], {
      env: { ...process.env, COLUMNS: '512' },
      timeout: 3_000,
    })
    return parsePsTable(stdout)
  } catch {
    return []
  }
}

const inspectDesktopProcesses = async () => {
  const rows = await listProcessRows()
  const selfRow = rows.find((row) => row.pid === process.pid)
  const protectedPids = collectAncestorPids(rows, process.pid)
  if (selfRow) protectedPids.add(selfRow.pgid)
  protectedPids.add(process.pid)
  if (process.ppid) protectedPids.add(process.ppid)
  return {
    protectedPids,
    stale: collectStaleDesktopProcesses(rows, { protectedPids, rootDir }),
  }
}

/** 仅 Electron 应用进程（不含 electron-vite），用于判断窗口是否真正拉起 */
const listElectronAppPids = async (): Promise<number[]> => {
  const rows = await listProcessRows()
  return rows
    .filter((row) => !row.state.startsWith('Z') && isElectronAppCommand(row.command, rootDir))
    .map((row) => row.pid)
}

const formatStaleProcess = (row: ProcessRow) => `${row.pid} (${row.command.slice(0, 80)})`

const clearElectronSingletonLocks = async () => {
  if (isWindows) return

  const home = homedir()
  const candidates = [
    path.join(home, 'Library/Application Support/purechat-desktop'),
    path.join(home, 'Library/Application Support/Electron'),
  ]

  for (const dir of candidates) {
    await Promise.all(
      ELECTRON_SINGLETON_NAMES.map((name) => rm(path.join(dir, name), { force: true }).catch(() => undefined))
    )
  }
}

const signalGroup = (pgid: number, signal: NodeJS.Signals) => {
  try {
    process.kill(-pgid, signal)
  } catch {
    // Already exited, or this process is not allowed to signal the group.
  }
}

/**
 * 清掉上次未退出的 Electron / electron-vite。
 * 必须 SIGKILL 整棵进程组：SIGTERM 会给 electron-vite 机会重启主进程，留下白屏旧窗。
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

    const { pgids, pids } = collectKillTargets(stale, protectedPids)
    for (const pgid of pgids) signalGroup(pgid, 'SIGKILL')
    for (const pid of pids) signalPid(pid, 'SIGKILL')
    await wait(STALE_KILL_INTERVAL_MS)
  }

  const remaining = (await inspectDesktopProcesses()).stale
  if (remaining.length === 0) return

  throw new Error(`无法结束残留桌面进程: ${remaining.map(formatStaleProcess).join('; ')}`)
}

/** 重启前确保旧 Electron 与 renderer 端口都已退出，释放单实例锁 */
const prepareCleanDesktopStart = async () => {
  await killStaleDesktopProcesses()
  await freeRendererPort(rendererPort)
  await clearElectronSingletonLocks()

  const portDeadline = Date.now() + PORT_FREE_WAIT_MS
  while (Date.now() < portDeadline && (await isPortOpen(rendererPort))) {
    await freeRendererPort(rendererPort)
    await wait(200)
  }

  await wait(150)
}

const waitForElectronApp = async (timeoutMs: number, existingPids: ReadonlySet<number>) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const pids = await listElectronAppPids()
    if (pids.some((pid) => !existingPids.has(pid))) return true
    await wait(300)
  }
  return false
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

    const result = await Promise.race([
      waitForExit(child).then((code) => ({ kind: 'exit' as const, code })),
      waitForPort(rendererPort, ELECTRON_READY_WAIT_MS)
        .then(async () => {
          const ready = await waitForElectronApp(ELECTRON_READY_WAIT_MS, existingAppPids)
          return ready ? ({ kind: 'ready' as const } as const) : ({ kind: 'no-app' as const } as const)
        })
        .catch(() => ({ kind: 'no-renderer' as const })),
    ])

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
    void cleanup().finally(() => {
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

void main()
