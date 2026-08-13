#!/usr/bin/env node
/**
 * 并行跑若干根目录 npm script，任一非 0 则失败。
 *
 * 用法：`node scripts/run-parallel.mjs lint:ts lint:style`
 */
import { spawn } from 'node:child_process'
import process from 'node:process'

const scripts = process.argv.slice(2).filter(Boolean)

if (scripts.length === 0) {
  console.error('usage: node scripts/run-parallel.mjs <npm-script>...')
  process.exit(2)
}

function run(name) {
  return new Promise((resolve) => {
    const child = spawn('pnpm', ['run', name], {
      stdio: 'inherit',
      shell: true,
      env: process.env,
    })
    child.on('close', (code, signal) => {
      resolve({ name, code: code ?? (signal ? 1 : 0) })
    })
    child.on('error', (err) => {
      console.error(`[run-parallel] failed to start ${name}:`, err)
      resolve({ name, code: 1 })
    })
  })
}

const results = await Promise.all(scripts.map(run))
const failed = results.filter((r) => r.code !== 0)

if (failed.length > 0) {
  console.error(
    `[run-parallel] failed: ${failed.map((f) => `${f.name} (exit ${f.code})`).join(', ')}`
  )
  process.exit(1)
}
