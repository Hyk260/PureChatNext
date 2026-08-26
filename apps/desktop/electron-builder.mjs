import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { verifyAfterPack } from './scripts/verify-package.mjs'

const desktopDir = path.dirname(fileURLToPath(import.meta.url))
const appIcon = path.join(desktopDir, 'build/icon.png')
const trayIcon = path.join(desktopDir, 'build/tray.png')

// pnpm 不会把 apps/desktop/.npmrc 的 electron_builder_binaries_mirror 注入进
// electron-builder 子进程；不设的话 dmgbuild 会回落到 GitHub Releases，国内极慢。
if (!process.env.ELECTRON_BUILDER_BINARIES_MIRROR) {
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR =
    'https://npmmirror.com/mirrors/electron-builder-binaries/'
}

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: 'com.purechat.desktop',
  productName: 'PureChat',
  electronLanguages: ['zh-CN'],
  directories: {
    buildResources: path.join(desktopDir, 'build'),
    output: path.join(desktopDir, 'release'),
  },
  icon: appIcon,
  electronDownload: {
    mirror: 'https://npmmirror.com/mirrors/electron/',
  },
  // Main/preload already bundle application code; only Node/Electron imports remain external.
  files: ['dist/**/*', 'package.json', '!node_modules', '!**/*.map'],
  // Returning false marks node_modules as handled outside electron-builder, skipping native
  // rebuild and pnpm workspace collection. Do not also set npmRebuild: false — that
  // short-circuits beforeBuild and the monorepo collector still runs.
  beforeBuild: () => false,
  extraResources: [
    { from: appIcon, to: 'purechat-appicon.png' },
    { from: trayIcon, to: 'tray.png' },
  ],
  afterPack: verifyAfterPack,
  protocols: [{ name: 'PureChat', schemes: ['purechat'] }],
  mac: {
    category: 'public.app-category.productivity',
    icon: appIcon,
    compression: 'maximum',
    artifactName: '${productName}-${version}-${arch}.${ext}',
    // arm64 = Apple Silicon（M 系列）；x64 = Intel Mac。分别打两个包，不是 universal。
    target: [
      {
        target: 'dmg',
        arch: [
          'arm64',
          // 'x64'
        ],
      },
      {
        target: 'zip',
        arch: [
          'arm64',
          // 'x64'
        ],
      },
    ],
  },
  dmg: {
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },
  win: {
    icon: appIcon,
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] },
    ],
  },
  nsis: {
    artifactName: '${productName}-${version}-setup.${ext}',
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
  },
  portable: {
    artifactName: '${productName}-${version}-portable.${ext}',
  },
  publish: null,
}

export default config
