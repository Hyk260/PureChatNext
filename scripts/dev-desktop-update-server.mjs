#!/usr/bin/env node
// 本地开发更新下载服务（只读 release 产物，不会修改安装包）。
//
// 常见用法：
//   pnpm dev:desktop:update-server
//   pnpm dev:desktop:update-server --kbps 512
//   pnpm dev:desktop:update-server --version 0.2.2 --artifact PureChat-0.2.0-arm64.zip
//   pnpm dev:desktop:update-server --channel rc --version 0.2.2-rc.1
//   pnpm dev:desktop:update-server --platform win --arch x64 --artifact PureChat-0.2.0-setup.exe
//
// 默认监听 127.0.0.1:5500，默认限速 3 MiB/s（3072 KiB/s），便于观察开发环境的下载进度。
// 使用 --kbps 0 可关闭限速；启动后将 PURECHAT_DESKTOP_UPDATE_URL 配置为服务地址。
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const desktopDir = fileURLToPath(new URL('../apps/desktop/', import.meta.url))
const CHANNELS = ['latest', 'rc', 'beta']
const DEFAULT_KBPS = 3 * 1024

export async function selectArtifact(releaseDir, platform, arch, artifact) {
  if (!['mac', 'win'].includes(platform) || !['arm64', 'x64'].includes(arch)) {
    throw new Error('Use --platform mac|win and --arch arm64|x64')
  }
  let name = artifact
  if (!name) {
    const suffix = platform === 'mac' ? `-${arch}.zip` : '-setup.exe'
    const names = (await readdir(releaseDir)).filter((entry) => entry.startsWith('PureChat-') && entry.endsWith(suffix))
    const candidates = await Promise.all(
      names.map(async (entry) => ({ name: entry, mtime: (await stat(path.join(releaseDir, entry))).mtimeMs }))
    )
    candidates.sort((a, b) => b.mtime - a.mtime)
    name = candidates[0]?.name
  }
  if (!name) throw new Error('No update artifact found. Build mac ZIP or Windows NSIS first, or use --artifact.')
  if (path.basename(name) !== name || name.includes('\\')) throw new Error('--artifact must be a filename in release/')
  const valid = platform === 'mac' ? name.endsWith('.zip') : name.endsWith('-setup.exe')
  if (!valid)
    throw new Error('Updates require macOS ZIP or Windows NSIS setup.exe; DMG/portable are not update payloads.')
  const file = path.join(releaseDir, name)
  if (!(await stat(file)).isFile()) throw new Error('Artifact must be a regular file')
  return file
}

export function parseRange(header, size) {
  if (!header) return { start: 0, end: size - 1, partial: false }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match || (!match[1] && !match[2])) return null
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return null
  return { start, end, partial: true }
}

export async function createUpdateServer({
  releaseDir,
  artifact,
  platform = 'mac',
  arch = 'arm64',
  version,
  channel = 'latest',
  kbps = DEFAULT_KBPS,
}) {
  if (!CHANNELS.includes(channel)) throw new Error('Use --channel latest|rc|beta')
  const versionMatch = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(rc|beta)\.(0|[1-9]\d*))?$/.exec(version || '')
  if (!versionMatch || (versionMatch[4] || 'latest') !== channel) {
    throw new Error('Version must match channel: X.Y.Z, X.Y.Z-rc.N or X.Y.Z-beta.N')
  }
  if (!Number.isFinite(kbps) || kbps < 0) throw new Error('--kbps must be a non-negative number')
  const file = await selectArtifact(releaseDir, platform, arch, artifact)
  const name = path.basename(file)
  const size = (await stat(file)).size
  const hash = createHash('sha512')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  const sha512 = hash.digest('base64')
  const fileUrl = encodeURIComponent(name)
  const metadata = {
    version,
    files: [{ url: fileUrl, sha512, size }],
    path: fileUrl,
    sha512,
    releaseDate: new Date().toISOString(),
    releaseNotes: '本地下载测试：元数据版本用于触发更新，包内版本仍以原始安装包为准。请仅使用开发版下载验证。',
  }
  // JSON is valid YAML and can be read by electron-updater's YAML parser.
  const body = Buffer.from(JSON.stringify(metadata, null, 2) + '\n')
  const manifestPath = `/${channel}${platform === 'mac' ? '-mac' : ''}.yml`
  const downloads = new Map([[`/${fileUrl}`, file]])
  try {
    if ((await stat(file + '.blockmap')).isFile()) downloads.set(`/${fileUrl}.blockmap`, file + '.blockmap')
  } catch {
    // Full downloads do not require a blockmap.
  }

  async function handle(request, response) {
    response.setHeader('Cache-Control', 'no-store')
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end()
      return
    }
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname
    if (pathname === manifestPath) {
      response.writeHead(200, { 'Content-Type': 'application/yaml', 'Content-Length': body.length })
      response.end(request.method === 'HEAD' ? undefined : body)
      return
    }
    const target = downloads.get(pathname)
    if (!target) {
      response.writeHead(404).end('Not found')
      return
    }
    const targetSize = (await stat(target)).size
    const range = parseRange(request.headers.range, targetSize)
    if (!range) {
      response.writeHead(416, { 'Content-Range': `bytes */${targetSize}` }).end()
      return
    }
    const headers = {
      'Accept-Ranges': 'bytes',
      'Content-Type': target.endsWith('.zip') ? 'application/zip' : 'application/octet-stream',
      'Content-Length': range.end - range.start + 1,
    }
    if (range.partial) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${targetSize}`
    response.writeHead(range.partial ? 206 : 200, headers)
    if (request.method === 'HEAD') {
      response.end()
      return
    }
    const abort = new AbortController()
    response.once('close', () => abort.abort())
    const source = createReadStream(target, { start: range.start, end: range.end, highWaterMark: 64 * 1024 })
    async function* throttle() {
      for await (const chunk of source) {
        if (kbps > 0) await delay((chunk.length / (kbps * 1024)) * 1000, undefined, { signal: abort.signal })
        yield chunk
      }
    }
    await pipeline(throttle(), response, { signal: abort.signal })
  }

  const server = createServer((request, response) => {
    handle(request, response).catch(() => {
      if (response.destroyed) return
      if (response.headersSent) response.destroy()
      else response.writeHead(500).end('Unable to read update artifact')
    })
  })
  return { server, metadata, manifestPath, artifact: file }
}

async function main() {
  const { values } = parseArgs({
    options: {
      port: { type: 'string', default: '5500' },
      platform: { type: 'string', default: process.platform === 'win32' ? 'win' : 'mac' },
      arch: { type: 'string', default: process.arch },
      artifact: { type: 'string' },
      version: { type: 'string' },
      channel: { type: 'string', default: 'latest' },
      kbps: { type: 'string', default: String(DEFAULT_KBPS) },
      help: { type: 'boolean' },
    },
  })
  if (values.help) {
    console.log(
      'pnpm dev:desktop:update-server [--port 5500] [--kbps 1024] [--platform mac|win] [--arch arm64|x64] [--artifact FILE] [--version X.Y.Z] [--channel latest|rc|beta]'
    )
    return
  }
  const port = Number(values.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('--port must be 1–65535')
  const pkg = JSON.parse(await readFile(path.join(desktopDir, 'package.json'), 'utf8'))
  const parts = pkg.version.split('.').map(Number)
  const nextVersion = `${parts[0]}.${parts[1]}.${parts[2] + 1}`
  const version = values.version || (values.channel === 'latest' ? nextVersion : `${nextVersion}-${values.channel}.1`)
  const { server, manifestPath, artifact } = await createUpdateServer({
    ...values,
    version,
    kbps: Number(values.kbps),
    releaseDir: path.join(desktopDir, 'release'),
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  console.log(`Update feed: http://127.0.0.1:${port}${manifestPath}`)
  console.log(`Payload: ${artifact}\nTest version: ${version} (metadata only; artifact unchanged)`)
  console.log(
    `PURECHAT_DESKTOP_UPDATE_URL=http://127.0.0.1:${port}\nUse pnpm dev:desktop; test downloads only. Ctrl+C stops the server.`
  )
  const stop = () => {
    server.close()
    server.closeAllConnections()
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
