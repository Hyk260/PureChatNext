import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { verifyAfterPack } from './scripts/verify-package.mjs'

const desktopDir = path.dirname(fileURLToPath(import.meta.url))
const appIcon = path.join(desktopDir, 'build/icon.png')
const trayIcon = path.join(desktopDir, 'build/tray.png')

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: 'com.purechat.desktop',
  productName: 'PureChat',
  directories: {
    app: desktopDir,
    buildResources: path.join(desktopDir, 'build'),
    output: path.join(desktopDir, 'release'),
  },
  icon: appIcon,
  electronDownload: {
    mirror: 'https://npmmirror.com/mirrors/electron/',
  },
  // Main/preload bundle all application code; only Node/Electron imports remain external.
  files: ['dist/**/*', 'package.json', '!node_modules', '!**/*.map'],
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
    target: [
      { target: 'dmg', arch: ['arm64', 'x64'] },
      { target: 'zip', arch: ['arm64', 'x64'] },
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
