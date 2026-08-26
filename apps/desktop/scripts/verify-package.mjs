import { stat } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { listPackage } from '@electron/asar'

export const MAX_ASAR_BYTES = 64 * 1024 * 1024

export const verifyPackage = async (archivePath) => {
  const entries = listPackage(archivePath).map((entry) => entry.replaceAll('\\', '/').replace(/^\//, ''))
  const unexpected = entries.filter((entry) =>
    !(entry === 'package.json' || entry === 'dist' || entry.startsWith('dist/')) ||
    /(^|\/)(node_modules|\.env(?:\.[^/]*)?)(\/|$)/.test(entry) || entry.endsWith('.map')
  )
  if (unexpected.length) throw new Error(`桌面包包含非运行时文件: ${unexpected.slice(0, 10).join(', ')}`)

  for (const required of ['package.json', 'dist/main/index.js', 'dist/preload/index.cjs', 'dist/renderer/index.html']) {
    if (!entries.includes(required)) throw new Error(`桌面包缺少入口: ${required}`)
  }
  if (!entries.some((entry) => entry.startsWith('dist/renderer/assets/') && entry.endsWith('.css'))) {
    throw new Error('桌面包缺少渲染样式')
  }

  const { size } = await stat(archivePath)
  if (size > MAX_ASAR_BYTES) throw new Error(`桌面 app.asar 超出 64 MiB 预算: ${(size / 1024 / 1024).toFixed(1)} MiB`)
  return { bytes: size, entries: entries.length }
}

export const verifyAfterPack = async (context) => {
  const resourcesDir = context.electronPlatformName === 'darwin'
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources')
  const result = await verifyPackage(path.join(resourcesDir, 'app.asar'))
  console.info(`Desktop package verified: ${(result.bytes / 1024 / 1024).toFixed(1)} MiB, ${result.entries} entries`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error('用法: node scripts/verify-package.mjs <app.asar>')
  const result = await verifyPackage(path.resolve(process.argv[2]))
  console.info(`Desktop package verified: ${(result.bytes / 1024 / 1024).toFixed(1)} MiB, ${result.entries} entries`)
}
