#!/usr/bin/env node
/**
 * 扫描 SPA 构建产物，防止服务端环境变量值被 Vite 内联进前端 bundle。
 *
 * 检测来源：
 * 1. 进程环境中「canary」标记的服务端密钥（CI 注入）
 * 2. 本地 `.env` / `.env.local` 中非 NEXT_PUBLIC_* 的密钥值（本地回归）
 * 3. 常见凭证形态（sk- / postgres:// / redis:// / JWT / AKIA 等）
 *
 * 用法：
 *   pnpm run build:spa && pnpm run build:spa:copy && pnpm run check:spa-env-leak
 *
 * CI 请在 build:spa 前注入 canary，例如：
 *   OPENAI_API_KEY=ci-canary-openai-DO-NOT-LEAK-xxxx
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const SCAN_DIRS = ['dist', path.join('public', '_spa')]
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.json', '.map', '.txt', '.svg'])

/** 服务端密钥名（不含 NEXT_PUBLIC_*）。用于从 process.env / dotenv 抽取待比对值。 */
const SERVER_SECRET_KEYS = [
  'AI_GATEWAY_API_KEY',
  'AUTH_APPLE_CLIENT_SECRET',
  'AUTH_FEISHU_APP_SECRET',
  'AUTH_GITHUB_SECRET',
  'AUTH_GOOGLE_SECRET',
  'AUTH_SECRET',
  'AUTH_WECHAT_SECRET',
  'BETTER_AUTH_SECRET',
  'CRON_SECRET',
  'DATABASE_TEST_URL',
  'DATABASE_URL',
  'DEEPSEEK_API_KEY',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_ELECTRON_SECRET',
  'IM_SDK_KEY',
  'JWKS_KEY',
  'KEY_VAULTS_SECRET',
  'OPENAI_API_KEY',
  'PURECHAT_API_KEY',
  'QQ_WEBHOOK_SECRET',
  'REDIS_PASSWORD',
  'REDIS_URL',
  'RESEND_API_KEY',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'SMTP_PASS',
  'WECHAT_WEBHOOK_SECRET',
]

const CANARY_MARKER = 'DO-NOT-LEAK'

const CREDENTIAL_PATTERNS = [
  { name: 'openai-sk', re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: 'resend-re', re: /\bre_[A-Za-z0-9]{20,}\b/g },
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: 'postgres-url', re: /\bpostgres(?:ql)?:\/\/[^\s"'`]+/gi },
  { name: 'redis-url', re: /\brediss?:\/\/[^\s"'`]+/gi },
  { name: 'aws-akia', re: /\bAKIA[0-9A-Z]{16}\b/g },
]

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(full, out)
      continue
    }
    if (!entry.isFile()) continue
    const ext = path.extname(entry.name).toLowerCase()
    if (!TEXT_EXTENSIONS.has(ext)) continue
    // source maps 很大且易含源码路径；仍扫描以防 define 泄漏进 map
    out.push(full)
  }
  return out
}

function parseDotEnv(filePath) {
  if (!existsSync(filePath)) return {}
  const result = {}
  for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) result[key] = value
  }
  return result
}

function collectEnvMaps() {
  /** @type {Map<string, Set<string>>} value -> keys */
  const secretValues = new Map()
  /** 允许出现在前端的公开值（NEXT_PUBLIC_*），形态扫描时跳过 */
  const publicValues = new Set()

  const addSecret = (key, value) => {
    if (!value || typeof value !== 'string') return
    if (key.startsWith('NEXT_PUBLIC_')) return
    if (!SERVER_SECRET_KEYS.includes(key) && !value.includes(CANARY_MARKER)) return
    // 过短值易误报（如 "1" / "true"）
    if (value.length < 12) return
    if (!secretValues.has(value)) secretValues.set(value, new Set())
    secretValues.get(value).add(key)
  }

  const consider = (key, value) => {
    if (!value || typeof value !== 'string') return
    if (key.startsWith('NEXT_PUBLIC_')) {
      if (value.length >= 12) publicValues.add(value)
      return
    }
    addSecret(key, value)
  }

  for (const key of SERVER_SECRET_KEYS) {
    consider(key, process.env[key])
  }

  // CI / 本地显式注入的 canary（任意 KEY，值含 DO-NOT-LEAK）
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string' && value.includes(CANARY_MARKER)) {
      consider(key, value)
    }
  }

  for (const file of ['.env', '.env.local']) {
    const parsed = parseDotEnv(path.join(ROOT, file))
    for (const [key, value] of Object.entries(parsed)) {
      consider(key, value)
    }
  }

  return { secretValues, publicValues }
}

function main() {
  const scanRoots = SCAN_DIRS.map((d) => path.join(ROOT, d)).filter((d) => existsSync(d))
  if (scanRoots.length === 0) {
    console.error('❌ SPA 构建产物不存在（期望 dist/ 或 public/_spa/）。请先运行 build:spa && build:spa:copy。')
    process.exit(1)
  }

  const files = scanRoots.flatMap((d) => walkFiles(d))
  if (files.length === 0) {
    console.error('❌ 未找到可扫描的 SPA 文本资源。')
    process.exit(1)
  }

  const { secretValues, publicValues } = collectEnvMaps()
  /** @type {{ file: string, kind: string, detail: string }[]} */
  const hits = []

  for (const file of files) {
    let text
    try {
      // 跳过超大文件（>8MB）以免 OOM；正常 chunk 远小于此
      if (statSync(file).size > 8 * 1024 * 1024) continue
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }

    const rel = path.relative(ROOT, file)

    for (const [value, keys] of secretValues) {
      if (text.includes(value)) {
        hits.push({
          file: rel,
          kind: 'secret-value',
          detail: `内联了环境变量值（keys: ${[...keys].join(', ')}）`,
        })
      }
    }

    for (const { name, re } of CREDENTIAL_PATTERNS) {
      re.lastIndex = 0
      let match
      while ((match = re.exec(text)) !== null) {
        if (publicValues.has(match[0])) continue
        const sample = match[0].length > 48 ? `${match[0].slice(0, 48)}…` : match[0]
        hits.push({
          file: rel,
          kind: name,
          detail: `疑似凭证字面量: ${sample}`,
        })
        break
      }
    }
  }

  const canaryCount = [...secretValues.keys()].filter((v) => v.includes(CANARY_MARKER)).length
  console.log(
    `🔍 SPA env leak check: ${files.length} files in ${scanRoots.map((d) => path.relative(ROOT, d)).join(', ')}; ${secretValues.size} secret values (${canaryCount} canaries)`
  )

  if (hits.length > 0) {
    console.error('❌ 检测到可能的前端环境变量泄漏：')
    for (const hit of hits.slice(0, 50)) {
      console.error(`  - [${hit.kind}] ${hit.file}: ${hit.detail}`)
    }
    if (hits.length > 50) console.error(`  … 另有 ${hits.length - 50} 条`)
    process.exit(1)
  }

  if (canaryCount === 0 && secretValues.size === 0) {
    console.warn(
      '⚠️ 未提供 canary 或本地 .env 密钥值；仅完成形态扫描。CI 请注入含 DO-NOT-LEAK 的服务端密钥后再 build:spa。'
    )
  }

  console.log('✅ SPA 构建产物未发现服务端密钥值泄漏')
}

main()
