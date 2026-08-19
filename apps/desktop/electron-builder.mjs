import path from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopDir = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('electron-builder').Configuration} */
export default {
  appId: 'com.purechat.desktop',
  productName: 'PureChat',
  directories: {
    app: desktopDir,
    buildResources: path.join(desktopDir, 'build'),
    output: path.join(desktopDir, 'release'),
  },
  files: ['dist/**/*', 'package.json'],
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
