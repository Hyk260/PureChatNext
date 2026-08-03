/**
 * 清理 Next.js / Turbopack 本地缓存，释放磁盘与内存压力。
 * 跨平台（Windows / macOS / Linux），用法: `pnpm clean`
 */
import { execFileSync } from 'node:child_process'
import { lstat, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TARGETS = ['.next', path.join('node_modules', '.cache')] as const

const isWindows = process.platform === 'win32'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  const kib = bytes / 1024
  if (kib < 1024) return `${kib < 10 ? kib.toFixed(1) : Math.round(kib)}K`
  const mib = kib / 1024
  if (mib < 1024) return `${mib < 10 ? mib.toFixed(1) : Math.round(mib)}M`
  const gib = mib / 1024
  return `${gib < 10 ? gib.toFixed(1) : Math.round(gib)}G`
}

async function pathSizeBytes(targetPath: string): Promise<number> {
  let stats
  try {
    stats = await lstat(targetPath)
  } catch {
    return 0
  }

  if (stats.isSymbolicLink() || stats.isFile()) return stats.size
  if (!stats.isDirectory()) return 0

  let total = 0
  let entries: string[]
  try {
    entries = await readdir(targetPath)
  } catch {
    return 0
  }

  for (const entry of entries) {
    total += await pathSizeBytes(path.join(targetPath, entry))
  }
  return total
}

function isNextProcessRunning(): boolean {
  try {
    if (isWindows) {
      const out = execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Where-Object { $_.CommandLine -match 'next(\\s+|\\.js\\s+)(dev|start)\\b' } | Select-Object -First 1 -ExpandProperty ProcessId",
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }
      )
      return out.trim().length > 0
    }

    execFileSync('pgrep', ['-f', '[n]ext (dev|start)'], {
      stdio: 'ignore',
    })
    return true
  } catch {
    return false
  }
}

function warnIfNextRunning() {
  if (!isNextProcessRunning()) return

  console.log('⚠ 检测到 Next.js 进程仍在运行，建议先 Ctrl+C 停掉再清缓存（否则可能删不干净或立刻重新涨缓存）。')
  if (isWindows) {
    console.log('  强制结束: 在任务管理器结束 node / next，或关闭对应终端任务')
  } else {
    console.log('  强制结束: pkill -f "next (dev|start)" || true')
  }
  console.log()
}

async function main() {
  process.chdir(ROOT)
  warnIfNextRunning()

  let freedBytes = 0

  for (const relativeTarget of TARGETS) {
    const targetPath = path.join(ROOT, relativeTarget)
    let exists = false
    try {
      await lstat(targetPath)
      exists = true
    } catch {
      exists = false
    }

    if (!exists) {
      console.log(`Skip ${relativeTarget} (not found)`)
      continue
    }

    const size = await pathSizeBytes(targetPath)
    console.log(`Removing ${relativeTarget} (${formatBytes(size)}) ...`)
    await rm(targetPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    freedBytes += size
  }

  console.log()
  if (freedBytes > 0) {
    const mb = Math.floor(freedBytes / (1024 * 1024))
    console.log(`✓ 已清理约 ${mb} MB。下次 pnpm dev 会重新冷编译（首次打开页面会稍慢属正常）。`)
  } else {
    console.log('✓ 没有可清理的缓存目录。')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
