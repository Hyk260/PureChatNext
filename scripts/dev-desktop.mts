import net from 'node:net'
import { spawn, type ChildProcess } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { parse } from 'dotenv'

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

const spawnProcess = (command: string, args: string[]) =>
  spawn(command, args, {
    cwd: rootDir,
    env: desktopProcessEnv,
    shell: process.platform === 'win32',
    stdio: 'inherit',
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

const stopProcess = (child: ChildProcess | undefined) => {
  if (child && !child.killed) child.kill('SIGTERM')
}

const waitForExit = (child: ChildProcess) =>
  new Promise<number>((resolve) => {
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)))
  })

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
    if (await isPortOpen(nextPort)) {
      console.log(`Reusing shared Next.js BFF at http://localhost:${nextPort}`)
    } else {
      console.log(`Starting shared Next.js BFF on http://localhost:${nextPort}`)
      nextProcess = spawnProcess('bun', ['run', 'dev:next', '--', '-p', String(nextPort)])
    }
    await waitForPort(nextPort)

    console.log(`Starting Electron renderer on http://127.0.0.1:${rendererPort}`)
    electronProcess = spawnProcess('pnpm', ['--dir', 'apps/desktop', 'dev'])

    const exitPromises = [waitForExit(electronProcess!)]
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
