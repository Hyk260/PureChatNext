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

// 根据当前脚本文件的位置定位仓库根目录，避免命令从其他工作目录执行时
// 相对路径解析到错误位置。
const root = fileURLToPath(new URL('../../', import.meta.url))

async function main() {
  // 解析桌面发布命令的参数：默认发布所有平台的既有产物，
  // 也可指定平台、产物目录、版本和环境文件；--package 用于先打包再发布。
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

  // 帮助信息只展示用法并正常结束，不继续读取环境配置或访问存储服务。
  if (values.help) {
    console.info(
      'desktop:upload --platform windows|mac|all [--dir PATH] [--version X.Y.Z] [--env-file PATH] [--dry-run] [--package]\n默认读取根 .env.local/.env；--dry-run 只校验本地产物并读取远端，不构建、上传、加锁或删除。'
    )
    return
  }

  // 限制平台输入为受支持的选项，避免传入无效值后出现空发布或错误平台配置。
  if (!['windows', 'mac', 'all'].includes(values.platform)) throw new Error('platform 必须是 windows、mac 或 all')

  // 环境文件优先使用显式指定的路径；未指定时采用仓库根目录的 .env.local。
  // 若显式指定的文件不存在就立即报错，避免误用其他环境中的发布凭据。
  const envPath = path.resolve(root, values['env-file'] || '.env.local')
  if (values['env-file'] && !existsSync(envPath)) throw new Error('指定环境文件不存在')

  // shell/CI 优先；dotenv 先读取 .env.local，缺失字段再回退 .env。
  loadEnv({ path: [envPath, path.join(root, '.env')], quiet: true })

  // 根据环境变量生成上传配置；发布版本默认取仓库根 package.json 的版本号。
  const config = getDesktopPublishConfig()
  const version = values.version || JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version

  // 将 all 展开为当前支持的平台列表；后续校验、读取产物和上传均使用此列表。
  const platforms = DESKTOP_PLATFORMS.filter((platform) => values.platform === 'all' || values.platform === platform)

  if (values.package) {
    // 打包命令一次只生成一个平台的产物，且打包版本、输出目录由项目配置固定，
    // 因此禁止组合发布全部平台或覆盖版本/目录参数，避免产物与发布元数据不一致。
    if (platforms.length !== 1) throw new Error('打包上传必须选择一个平台')
    if (values.version) throw new Error('打包版本由根 package.json 决定，不接受 --version')
    if (values.dir !== 'apps/desktop/release') throw new Error('打包上传使用固定 release 目录，不接受 --dir')

    if (!values['dry-run']) {
      // 按平台选择对应的打包脚本，并将更新服务地址传给构建过程，
      // 使桌面客户端内置的更新源与本次发布配置一致。
      const command = platforms[0] === 'windows' ? 'package:desktop:win' : 'package:desktop:mac'
      const buildEnv = { ...process.env, PURECHAT_DESKTOP_UPDATE_URL: config.updateUrl }

      // 构建只需要生成本地文件，不应接触对象存储密钥；
      // 即使调用环境中已有这些变量，也从子进程环境中移除。
      delete buildEnv.S3_ACCESS_KEY_ID
      delete buildEnv.S3_SECRET_ACCESS_KEY

      // 继承终端输入输出，便于实时查看打包进度；只有构建成功才继续发布。
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

  // 上传前验证本地更新源配置，并按平台、版本读取发布所需文件及元数据。
  // dry-run 也执行这些校验，确保模拟发布使用的本地产物本身有效。
  await verifyBuiltUpdateSource(path.resolve(root, values.dir), config.updateUrl)
  const releases = await Promise.all(
    platforms.map((platform) => readDesktopRelease(path.resolve(root, values.dir), platform, version))
  )

  // 创建 S3 客户端并逐个平台发布；模拟模式由发布函数处理，只进行允许的检查，
  // 不执行真实上传等写操作。
  const client = new S3Client(config.clientOptions)
  try {
    for (const release of releases) await publishDesktopRelease(client, config, release, { dryRun: values['dry-run'] })
  } finally {
    // 无论发布成功或失败，都关闭客户端并释放其底层网络资源。
    client.destroy()
  }
}

// 统一处理入口中的异步异常：输出可读错误信息，并通过非零退出码通知 shell/CI 失败。
main().catch((error) => {
  console.error(error instanceof Error ? error.message : '桌面发布失败')
  process.exitCode = 1
})
