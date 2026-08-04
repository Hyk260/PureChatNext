#!/usr/bin/env node
/**
 * 静态检查：SPA/客户端源码不得 import 服务端 env / supabase。
 * 与 eslint.config.js 的 no-restricted-imports 互补；供 CI 单独跑，不受其它 lint 规则干扰。
 *
 * 用法：`pnpm run lint:spa-env-imports`
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()

const SCAN_ROOTS = [
  'src/spa',
  'src/features',
  'src/hooks',
  'src/services',
  'src/utils',
  'src/routes',
  'src/layout',
  'src/libs/better-auth/client',
  'src/components',
]

const EXTRA_FILES = ['src/initialize.ts']

/** Analytics 允许 `@/envs/analytics`，其余 server env 仍禁止 */
const ANALYTICS_ALLOW = path.normalize('src/components/Analytics')

const FORBIDDEN = [
  { re: /from\s+['"]@\/envs(?:\/[^'"]*)?['"]/g, label: '@/envs' },
  { re: /from\s+['"]@pure\/env(?:\/[^'"]*)?['"]/g, label: '@pure/env' },
  { re: /from\s+['"]@\/libs\/supabase(?:\/[^'"]*)?['"]/g, label: '@/libs/supabase' },
  { re: /import\s*\(\s*['"]@\/envs(?:\/[^'"]*)?['"]\s*\)/g, label: '@/envs (dynamic)' },
  { re: /import\s*\(\s*['"]@pure\/env(?:\/[^'"]*)?['"]\s*\)/g, label: '@pure/env (dynamic)' },
]

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue
    if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) continue
    out.push(full)
  }
  return out
}

function isAllowedAnalyticsEnvImport(file, match) {
  const rel = path.relative(ROOT, file)
  if (!rel.startsWith(ANALYTICS_ALLOW + path.sep) && rel !== ANALYTICS_ALLOW) return false
  return /@\/envs\/analytics['"]/.test(match) || /@pure\/env\/analytics['"]/.test(match)
}

function main() {
  const files = [
    ...SCAN_ROOTS.flatMap((d) => walk(path.join(ROOT, d))),
    ...EXTRA_FILES.map((f) => path.join(ROOT, f)).filter((f) => existsSync(f) && statSync(f).isFile()),
  ]

  /** @type {{ file: string, line: number, match: string, label: string }[]} */
  const hits = []

  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // 跳过纯类型导入：`import type { … } from '@/envs/…'`
      if (/^\s*import\s+type\s/.test(line)) continue

      for (const { re, label } of FORBIDDEN) {
        re.lastIndex = 0
        let m
        while ((m = re.exec(line)) !== null) {
          if (isAllowedAnalyticsEnvImport(file, m[0])) continue
          hits.push({
            file: path.relative(ROOT, file),
            line: i + 1,
            match: m[0],
            label,
          })
        }
      }
    }
  }

  console.log(`🔍 SPA env import check: ${files.length} files`)

  if (hits.length > 0) {
    console.error('❌ 客户端源码禁止导入服务端 env / supabase：')
    for (const hit of hits) {
      console.error(`  - ${hit.file}:${hit.line} [${hit.label}] ${hit.match}`)
    }
    process.exit(1)
  }

  console.log('✅ 未发现 SPA/客户端非法 env 导入')
}

main()
