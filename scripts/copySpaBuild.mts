import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const src = path.join(root, 'dist')
const dest = path.join(root, 'public', '_spa')

if (!existsSync(src)) {
  console.error(`❌ SPA build output not found: ${src}`)
  process.exit(1)
}

rmSync(dest, { force: true, recursive: true })
mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true })

console.log(`✅ Copied SPA build: ${src} → ${dest}`)
