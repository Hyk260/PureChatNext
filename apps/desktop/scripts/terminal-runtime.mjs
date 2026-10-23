import { cp, mkdir, readFile, realpath, rm, stat, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopDir = fileURLToPath(new URL('../', import.meta.url))
export const terminalRuntimeDir = path.join(desktopDir, 'dist/terminal')

export async function prepareTerminalRuntime(platform, arch) {
  if (platform !== 'darwin') return
  const require = createRequire(path.join(desktopDir, 'package.json'))
  const wrapperRoot = path.dirname(require.resolve('@lydell/node-pty'))
  const wrapperRequire = createRequire(path.join(wrapperRoot, 'package.json'))
  const platformName = `@lydell/node-pty-${platform}-${arch}`
  const platformEntry = wrapperRequire.resolve(platformName)
  // 平台包入口在 lib/ 下，package.json 位于上一级。
  const platformRoot = path.resolve(path.dirname(platformEntry), '..')
  const manifest = JSON.parse(await readFile(path.join(platformRoot, 'package.json'), 'utf8'))
  if (manifest.name !== platformName) throw new Error(`终端平台依赖不匹配: ${platformName}`)
  await rm(terminalRuntimeDir, { recursive: true, force: true })
  const scope = path.join(terminalRuntimeDir, 'node_modules/@lydell')
  await mkdir(scope, { recursive: true })
  for (const [source, name] of [
    [wrapperRoot, 'node-pty'],
    [platformRoot, `node-pty-${platform}-${arch}`],
  ]) {
    await cp(await realpath(source), path.join(scope, name), {
      recursive: true,
      dereference: true,
      filter: (file) => path.basename(file) !== 'node_modules',
    })
  }
  await verifyTerminalRuntime(terminalRuntimeDir, arch)
}

export async function verifyTerminalRuntime(root, arch) {
  const packageRoot = path.join(root, `node_modules/@lydell/node-pty-darwin-${arch}`)
  const binary = path.join(packageRoot, `prebuilds/darwin-${arch}/pty.node`)
  const helper = path.join(packageRoot, `prebuilds/darwin-${arch}/spawn-helper`)
  await stat(path.join(root, 'node_modules/@lydell/node-pty/index.js'))
  await access(helper, constants.X_OK)
  const header = await readFile(binary)
  const cpuType = header.readUInt32LE(4)
  const expected = { arm64: 0x0100000c, x64: 0x01000007 }[arch]
  if (!expected || cpuType !== expected) throw new Error(`终端原生模块架构错误: ${arch}`)
}
