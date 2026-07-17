import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const src = path.join(root, 'dist')
const dest = path.join(root, 'public', '_spa')
const generatedTemplate = path.join(root, 'src', 'app', 'spa', 'spaHtmlTemplate.generated.ts')
/** Hashed chunk dirs produced by vite.config.ts (assets + vendor manual chunks). */
const copyDirs = ['assets', 'vendor']

if (!existsSync(src)) {
  console.error(`❌ SPA build output not found: ${src}`)
  process.exit(1)
}

const indexHtmlPath = path.join(src, 'index.html')
if (!existsSync(indexHtmlPath)) {
  console.error(`❌ SPA index.html not found: ${indexHtmlPath}`)
  process.exit(1)
}

const assetsSrc = path.join(src, 'assets')
if (!existsSync(assetsSrc)) {
  console.error(`❌ SPA assets not found: ${assetsSrc}`)
  process.exit(1)
}

const indexHtml = readFileSync(indexHtmlPath, 'utf-8')

rmSync(dest, { force: true, recursive: true })
mkdirSync(dest, { recursive: true })

for (const dir of copyDirs) {
  const sourceDir = path.join(src, dir)
  if (!existsSync(sourceDir)) continue
  cpSync(sourceDir, path.join(dest, dir), { recursive: true })
  console.log(`✅ Copied SPA ${dir}: ${sourceDir} → ${path.join(dest, dir)}`)
}

// index.html 不放入 public，由 `src/app/spa/[[...path]]/route.ts` 注入配置后下发。
writeFileSync(
  generatedTemplate,
  `/* 由 scripts/copySpaBuild.mjs 自动生成 — 请勿手改；本地 diff 可丢弃（仓库保留 stub） */\nexport default ${JSON.stringify(indexHtml)}\n`,
  'utf-8',
)

console.log(`✅ Wrote SPA HTML template: ${generatedTemplate}`)
