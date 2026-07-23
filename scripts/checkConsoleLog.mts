/* eslint-disable no-console */
/**
 * 检测 src/ 中的 `console.log` / `console.debug` 调用。
 *
 * 项目约定使用 `debug` 命名空间输出调试日志（见 .cursor/rules/debug-usage.md），
 * 业务代码不应直接使用 `console.log` / `console.debug`。
 *
 * 允许：
 *   - `console.warn` / `console.error` / `console.info`
 *   - 测试文件 `*.test.{ts,tsx}` / `*.spec.{ts,tsx}`
 *   - 脚本目录 `scripts/**`
 *   - 服务端入口 `src/app/api/**` 中的错误日志出口（仍允许 console.error/warn）
 *
 * 用法：`pnpm run lint:console`
 */
import { readdir, stat, readFile } from 'node:fs/promises'
import { join, relative, extname } from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const SCAN_DIR = 'src'
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx'])

// 命中即跳过该文件（不视为违规）
const SKIP_PATTERNS = [
  /[\\/]\.next[\\/]/,
  /[\\/]node_modules[\\/]/,
  /[\\/]dist[\\/]/,
  /[\\/]public[\\/]_spa[\\/]/,
  /[\\/]coverage[\\/]/,
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /[\\/]__tests__[\\/]/,
  /[\\/]__mocks__[\\/]/,
  /[\\/]tests[\\/]/,
  /spaHtmlTemplate\.generated\.ts$/,
]

// 仅检测这些 console 方法
const FORBIDDEN = /\bconsole\.(log|debug)\s*\(/

interface Violation {
  file: string
  line: number
  column: number
  snippet: string
}

async function walk(dir: string, files: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(full, files)
    } else if (entry.isFile()) {
      const ext = extname(entry.name)
      if (ALLOWED_EXTENSIONS.has(ext)) files.push(full)
    }
  }
  return files
}

function shouldSkip(relPath: string): boolean {
  return SKIP_PATTERNS.some((re) => re.test(relPath))
}

async function checkFile(absPath: string): Promise<Violation[]> {
  const relPath = relative(ROOT, absPath)
  if (shouldSkip(relPath)) return []

  const text = await readFile(absPath, 'utf8')
  const lines = text.split(/\r?\n/)
  const violations: Violation[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = FORBIDDEN.exec(line)
    if (!match) continue

    // 跳过注释行（简单启发式：去除前导空白后以 // 或 /* 开头）
    const trimmed = line.trimStart()
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue

    violations.push({
      file: relPath,
      line: i + 1,
      column: (match.index ?? 0) + 1,
      snippet: line.trim().slice(0, 120),
    })
  }
  return violations
}

async function main(): Promise<void> {
  const startDir = join(ROOT, SCAN_DIR)
  const st = await stat(startDir).catch(() => null)
  if (!st) {
    console.error(`[lint:console] scan dir not found: ${startDir}`)
    process.exit(2)
  }

  const files = await walk(startDir)
  const all: Violation[] = []
  for (const f of files) {
    const v = await checkFile(f)
    all.push(...v)
  }

  if (all.length === 0) {
    console.log(`[lint:console] OK — scanned ${files.length} files, no console.log/debug found.`)
    return
  }

  console.error(
    `[lint:console] Found ${all.length} console.log/debug call(s) in ${new Set(all.map((v) => v.file)).size} file(s):`
  )
  for (const v of all) {
    console.error(`  ${v.file}:${v.line}:${v.column}  ${v.snippet}`)
  }
  console.error('\n请使用 `debug` 命名空间日志替代（参考 .cursor/rules/debug-usage.md），或改用 console.warn/error。')
  process.exit(1)
}

main().catch((err) => {
  console.error('[lint:console] fatal:', err)
  process.exit(2)
})
