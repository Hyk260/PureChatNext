import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { S3Client } from '@aws-sdk/client-s3'
import { config as loadEnv } from 'dotenv'

import { getDesktopPublishConfig } from './lib/desktop-publish-config'
import {
  DESKTOP_PLATFORMS,
  publishDesktopRelease,
  readDesktopRelease,
  verifyBuiltUpdateSource,
} from './lib/desktop-publish'

const root = fileURLToPath(new URL('../../', import.meta.url))

async function main() {
  const { values } = parseArgs({
    options: {
      platform: { type: 'string', default: 'all' },
      dir: { type: 'string', default: 'apps/desktop/release' },
      version: { type: 'string' },
      'env-file': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      package: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  })
  if (values.help) {
    console.info(
      'desktop:upload --platform windows|mac|all [--dir PATH] [--version X.Y.Z] [--env-file PATH] [--dry-run] [--package]\n默认读取根 .env.local/.env；--dry-run 只校验本地产物并读取远端，不构建、上传、加锁或删除。'
    )
    return
  }
  if (!['windows', 'mac', 'all'].includes(values.platform)) throw new Error('platform 必须是 windows、mac 或 all')
  const envPath = path.resolve(root, values['env-file'] || '.env.local')
  if (values['env-file'] && !existsSync(envPath)) throw new Error('指定环境文件不存在')
  // shell/CI 优先；dotenv 先读取 .env.local，缺失字段再回退 .env。
  loadEnv({ path: [envPath, path.join(root, '.env')], quiet: true })
  const config = getDesktopPublishConfig()
  const version = values.version || JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version
  const platforms = DESKTOP_PLATFORMS.filter((platform) => values.platform === 'all' || values.platform === platform)

  if (values.package) {
    if (platforms.length !== 1) throw new Error('打包上传必须选择一个平台')
    if (values.version) throw new Error('打包版本由根 package.json 决定，不接受 --version')
    if (values.dir !== 'apps/desktop/release') throw new Error('打包上传使用固定 release 目录，不接受 --dir')
    if (!values['dry-run']) {
      const command = platforms[0] === 'windows' ? 'package:desktop:win' : 'package:desktop:mac'
      const buildEnv = { ...process.env, PURECHAT_DESKTOP_UPDATE_URL: config.updateUrl }
      delete buildEnv.S3_ACCESS_KEY_ID
      delete buildEnv.S3_SECRET_ACCESS_KEY
      await new Promise<void>((resolve, reject) => {
        const child = spawn('pnpm', [command], {
          cwd: root,
          stdio: 'inherit',
          shell: process.platform === 'win32',
          env: buildEnv,
        })
        child.once('error', reject)
        child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error('桌面打包失败，未上传'))))
      })
    }
  }

  await verifyBuiltUpdateSource(path.resolve(root, values.dir), config.updateUrl)
  const releases = await Promise.all(
    platforms.map((platform) => readDesktopRelease(path.resolve(root, values.dir), platform, version))
  )
  const client = new S3Client(config.clientOptions)
  try {
    for (const release of releases) await publishDesktopRelease(client, config, release, { dryRun: values['dry-run'] })
  } finally {
    client.destroy()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : '桌面发布失败')
  process.exitCode = 1
})
