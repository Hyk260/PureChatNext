import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { setupEnvironment } from './lib/env-setup'

/**
 * 首次部署生成并持久保存应用密钥，已有配置只补全缺失/空值，不执行密钥轮换。
 *
 * @example pnpm env:setup
 * @example pnpm env:setup --file .env.local
 * @example pnpm env:setup --file .env.production.local
 */
async function main() {
  const { values } = parseArgs({
    options: { file: { type: 'string', default: '.env' }, help: { type: 'boolean', short: 'h' } },
  })
  if (values.help) {
    console.info(`用法：pnpm env:setup [--file PATH]

默认从根 .env.example 创建根 .env；已有文件仅补全缺失或空值，非空配置原样保留。
生成 AUTH_SECRET、KEY_VAULTS_SECRET、TOOL_APPROVAL_SECRET、CRON_SECRET 和 RSA JWKS_KEY。
缺失字段优先复用 shell / CI 及其他根环境文件的配置，再生成随机值。
文件权限为 0600，不在终端输出密钥。相对路径以仓库根目录为基准。

示例：
  pnpm env:setup
  pnpm env:setup --file .env.local
  pnpm env:setup --file .env.production.local

DATABASE_URL 和第三方服务凭据需自行填写。生产部署还需修改 APP_URL。
旧数据库必须恢复原 KEY_VAULTS_SECRET；本命令仅用于初始化/补全，不能替代换钥迁移。`)
    return
  }

  const root = fileURLToPath(new URL('../', import.meta.url))
  const result = await setupEnvironment({ root, file: values.file })
  console.info(`${result.created ? '已创建' : '已检查并补全'} ${result.filePath}（权限 0600）`)
  if (result.generated.length) console.info(`已生成：${result.generated.join('、')}`)
  if (result.reused.length) console.info(`已复用并保存：${result.reused.join('、')}`)
  if (result.missing.length) console.warn(`仍需填写：${result.missing.join('、')}，请配置实际 PostgreSQL 连接地址。`)
  if (result.shadowed.length) {
    console.warn(`较高优先级文件中的空值会覆盖本次配置：${result.shadowed.join('；')}。请对该文件执行 --file 补全。`)
  }
  console.info('生产部署请将 APP_URL 改为正式地址；第三方 API / OAuth / 对象存储凭据按需填写。')
  console.info('请安全备份此文件；已有数据库请使用原有密钥，多实例部署需共享相同密钥。')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : '环境配置初始化失败')
  process.exitCode = 1
})
