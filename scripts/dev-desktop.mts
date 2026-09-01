import { execFile } from 'node:child_process'
import { spawn, type ChildProcess } from 'node:child_process'
import { readFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { promisify } from 'node:util'

import { parse } from 'dotenv'

const execFileAsync = promisify(execFile)
const isWindows = process.platform === 'win32'
const rootDir = process.cwd()
const desktopEnvPath = path.resolve(rootDir, 'apps/desktop/.env.desktop')
const desktopEnvLocalPath = path.resolve(rootDir, 'apps/desktop/.env.desktop.local')

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

const stopProcess = (child: ChildProcess | undefined) => {
  if (!child?.pid) return

  if (!isWindows) {
    try {
      process.kill(-child.pid, 'SIGTERM')
      return
    } catch {
      // Fall through to the direct child pid.
    }
  }

  if (!child.killed) {
    try {
      child.kill('SIGTERM')
    } catch {
      // Already exited.
    }
  }
}

const waitForExit = (child: ChildProcess) =>
  new Promise<number>((resolve) => {
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

  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    await wait(200)
    pids = await listListeningPids(port)
    if (pids.length === 0) return
  }

  console.log(`Force-killing desktop renderer on port ${port} (PID ${pids.join(', ')})`)
  for (const pid of pids) signalPid(pid, 'SIGKILL')
  await wait(200)
}

const listStaleDesktopPids = async (): Promise<number[]> => {
  if (isWindows) return []

  try {
    // 覆盖 electron-vite、主进程入口，以及带 purechat-desktop userData / app-path 的 Electron Helper
    const { stdout } = await execFileAsync(
      'pgrep',
      ['-f', 'electron-vite|apps/desktop/dist/main|purechat-desktop|app-path=.*/apps/desktop'],
      { timeout: 2_000 }
    )
    return [
      ...new Set(
        stdout
          .trim()
          .split('\n')
          .map((line) => Number(line))
          .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid)
      ),
    ]
  } catch {
    return []
  }
}

/** 清掉上次未退出的 Electron / electron-vite，避免单实例锁与 write EIO 弹窗 */
const killStaleDesktopProcesses = async () => {
  const pids = await listStaleDesktopPids()
  if (pids.length === 0) return

  console.log(`Stopping leftover desktop processes (PID ${pids.join(', ')})`)
  for (const pid of pids) signalPid(pid, 'SIGTERM')
  await wait(500)

  const remaining = await listStaleDesktopPids()
  for (const pid of remaining) signalPid(pid, 'SIGKILL')
  if (remaining.length > 0) await wait(200)
}

const main = async () => {
  let nextProcess: ChildProcess | undefined
  let electronProcess: ChildProcess | undefined
  let shuttingDown = false

  const cleanup = () => {
    if (shuttingDown) return
    shuttingDown = true
    stopProcess(electronProcess)
    stopProcess(nextProcess)
  }

  process.once('SIGINT', () => {
    cleanup()
  })
  process.once('SIGTERM', () => {
    cleanup()
  })

  try {
    await killStaleDesktopProcesses()
    await freeRendererPort(rendererPort)

    if (await isPortOpen(nextPort)) {
      console.log(`Reusing shared Next.js BFF at http://localhost:${nextPort}`)
    } else {
      console.log(`Starting shared Next.js BFF on http://localhost:${nextPort}`)
      nextProcess = spawnProcess('bun', ['run', 'dev:next', '--', '-p', String(nextPort)])
    }
    await waitForPort(nextPort)

    console.log(`Starting Electron renderer on http://127.0.0.1:${rendererPort}`)
    electronProcess = spawnProcess('pnpm', ['--dir', 'apps/desktop', 'dev'])

    const exitPromises = [waitForExit(electronProcess)]
    if (nextProcess) exitPromises.push(waitForExit(nextProcess))
    const exitCode = await Promise.race(exitPromises)
    cleanup()
    process.exitCode = exitCode
  } catch (error) {
    cleanup()
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

void main()
