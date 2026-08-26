import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { verifyAfterPack } from './scripts/verify-package.mjs'

const desktopDir = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: 'com.purechat.desktop',
  productName: 'PureChat',
  directories: {
    app: desktopDir,
    buildResources: path.join(desktopDir, 'build'),
    output: path.join(desktopDir, 'release'),
  },
  electronDownload: {
    mirror: 'https://npmmirror.com/mirrors/electron/',
  },
  // Main/preload bundle all application code; only Node/Electron imports remain external.
  files: ['dist/**/*', 'package.json', '!node_modules', '!**/*.map'],
  afterPack: verifyAfterPack,
  mac: {
    category: 'public.app-category.productivity',
    target: [
      { target: 'dmg', arch: ['arm64', 'x64'] },
      { target: 'zip', arch: ['arm64', 'x64'] },
    ],
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
  },
  publish: null,
}

export default config
