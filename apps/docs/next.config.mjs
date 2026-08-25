import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMDX } from 'fumadocs-mdx/next'

const docsDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(docsDir, '../..')
const nodeEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development'

// Next.js 只自动加载 apps/docs/.env*；Ask AI 与主应用共用仓库根目录的密钥。
for (const file of [`.env.${nodeEnv}.local`, '.env.local', `.env.${nodeEnv}`, '.env']) {
  const filePath = resolve(repoRoot, file)
  if (existsSync(filePath)) process.loadEnvFile(filePath)
}

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/index.md', destination: '/raw-content' },
      { source: '/:path*.md', destination: '/raw-content/:path*' },
    ]
  },
}

export default withMDX(config)
