#!/usr/bin/env node
/**
 * 本地 Electron 更新验证服务，只读发布产物，不改写 YAML、版本或安装包。
 *
 * production（默认）：提供 builder 生成的真实渠道 YAML、ZIP/DMG 或 NSIS，用于打包客户端验证。
 * development：生成模拟高版本元数据，仅供开发客户端下载测试，不能用于安装验收。
 *
 * 默认监听 http://127.0.0.1:5500，从 apps/desktop/release/ 读取文件。
 * 未传 --kbps 时按 10 秒周期模拟 1–10 MiB/s 波动，周期平均 8 MiB/s。
 * 每约 50 ms 发送一批数据，文件按 512 KiB 分块读取；支持背压和取消，避免逐小块创建计时器。
 * --kbps 单位为 KiB/s：显式指定固定速率，0 表示不限速。元数据响应不限速。
 * electron-updater 的实际进度通知约每秒一次，服务端分批不会改变此上报频率。
 *
 * 常用命令（仓库根目录运行）：
 *   pnpm dev:desktop:update-server                              # 真实发布源 + 默认网络波动
 *   pnpm dev:desktop:update-server --mode development           # 模拟高版本下载
 *   pnpm dev:desktop:update-server --kbps 8192                   # 固定 8 MiB/s
 *   pnpm dev:desktop:update-server --kbps 0                      # 不限速，验证校验/缓存
 *   pnpm dev:desktop:update-server --release-dir /path/to/release --port 5501
 *   pnpm dev:desktop:update-server --platform win --arch x64
 *   pnpm dev:desktop:update-server --mode development --channel rc --version 0.2.2-rc.1
 *   pnpm dev:desktop:update-server --mode development --artifact PureChat-0.2.1-arm64.zip --version 0.2.2
 *
 * 开发客户端需配置 PURECHAT_DESKTOP_UPDATE_URL 后重启；安装版使用包内 app-update.yml。
 * 生产模式启动前校验文件大小与 SHA-512，仅开放引用产物和对应 blockmap；Ctrl+C 停止。
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

import { load } from 'js-yaml'

const desktopDir = fileURLToPath(new URL('../../apps/desktop/', import.meta.url))
const CHANNELS = ['latest', 'rc', 'beta']
const SEND_INTERVAL_MS = 50
const DOWNLOAD_CHUNK_BYTES = 512 * 1024
// Equal-duration points form a repeatable network trace with an exact cycle mean of 8 MiB/s.
const NETWORK_SPEED_MIBPS = [8, 9, 10, 9, 8, 9, 10, 8, 8, 1]

/**
 * @param {number} elapsedMs
 * @param {number} [kbps]
 */
export function getDownloadKbps(elapsedMs, kbps) {
  if (kbps !== undefined) return kbps
  const seconds = Math.max(0, elapsedMs) / 1000
  const segment = Math.floor(seconds)
  const current = NETWORK_SPEED_MIBPS[segment % NETWORK_SPEED_MIBPS.length]
  const next = NETWORK_SPEED_MIBPS[(segment + 1) % NETWORK_SPEED_MIBPS.length]
  return (current + (next - current) * (seconds - segment)) * 1024
}

export function logServer(message) {
  const date = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  const timestamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  console.log(`${timestamp} [update-server] ${message}`)
}

function validateTarget(platform, arch) {
  if (!['mac', 'win'].includes(platform) || !['arm64', 'x64'].includes(arch)) {
    throw new Error('Use --platform mac|win and --arch arm64|x64')
  }
  if (platform === 'win' && arch !== 'x64') throw new Error('Current Windows packages support --arch x64 only')
}

function validateVersion(version, channel) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(rc|beta)\.(0|[1-9]\d*))?$/.exec(version || '')
  if (!match || (match[4] || 'latest') !== channel) {
    throw new Error('Version must match channel: X.Y.Z, X.Y.Z-rc.N or X.Y.Z-beta.N')
  }
}

async function resolveReleaseFile(releaseDir, name) {
  if (typeof name !== 'string') throw new Error('Artifact must have a local filename')
  const decoded = decodeURIComponent(name)
  if (!decoded || decoded === '.' || decoded === '..' || /[\\/:?#\0]/.test(decoded)) {
    throw new Error(
      'Artifact must be a local filename in release/; external URLs and directory traversal are forbidden'
    )
  }
  const root = await realpath(releaseDir)
  const file = await realpath(path.join(root, decoded))
  const relative = path.relative(root, file)
  if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || relative === '..') {
    throw new Error('Artifact symlink escapes release directory')
  }
  if (!(await stat(file)).isFile()) throw new Error('Artifact must be a regular file')
  // Keep the public filename even for an in-directory symlink.
  return path.join(root, decoded)
}

async function checksum(file) {
  const hash = createHash('sha512')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('base64')
}

export async function selectArtifact(releaseDir, platform, arch, artifact) {
  validateTarget(platform, arch)
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
  const valid = platform === 'mac' ? name.endsWith(`-${arch}.zip`) : name.endsWith('-setup.exe')
  if (!valid)
    throw new Error(
      'Updates require a matching macOS ZIP or Windows NSIS setup.exe; DMG/portable are not update payloads.'
    )
  return resolveReleaseFile(releaseDir, name)
}

export function parseRange(header, size) {
  if (!header) return { start: 0, end: size - 1, partial: false }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match || (!match[1] && !match[2])) return null
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size)
    return null
  return { start, end, partial: true }
}

async function productionFeed(releaseDir, manifestPath, platform, arch, channel) {
  const manifestFile = await resolveReleaseFile(releaseDir, manifestPath.slice(1))
  const body = await readFile(manifestFile)
  const metadata = load(body.toString('utf8'))
  if (!metadata || typeof metadata !== 'object') throw new Error('Invalid release metadata')
  validateVersion(metadata.version, channel)
  if (!Array.isArray(metadata.files) || !metadata.files.length) throw new Error('Release metadata must contain files')
  if (metadata.packages) throw new Error('Use full NSIS installers; web installer packages are not supported')
  const downloads = new Map()
  for (const entry of metadata.files) {
    if (!entry || typeof entry.url !== 'string') throw new Error('Release file must have a local URL')
    const file = await resolveReleaseFile(releaseDir, entry.url)
    const valid = platform === 'mac' ? /\.(zip|dmg)$/.test(file) : file.endsWith('-setup.exe')
    if (!valid) throw new Error('Release metadata contains an unsupported platform artifact')
    if (!Number.isSafeInteger(entry.size) || entry.size <= 0 || (await stat(file)).size !== entry.size) {
      throw new Error(`Release size mismatch: ${entry.url}`)
    }
    if (typeof entry.sha512 !== 'string' || (await checksum(file)) !== entry.sha512) {
      throw new Error(`Release SHA-512 mismatch: ${entry.url}`)
    }
    downloads.set(`/${encodeURIComponent(path.basename(file))}`, file)
  }
  const payload = metadata.files.find((entry) =>
    platform === 'mac' ? entry.url.endsWith(`-${arch}.zip`) : entry.url.endsWith('-setup.exe')
  )
  if (!payload) throw new Error(`No update artifact for ${platform}/${arch} in release metadata`)
  if (metadata.path !== undefined) {
    const primary = metadata.files.find((entry) => entry.url === metadata.path)
    if (!primary || metadata.sha512 !== primary.sha512) throw new Error('Legacy path/sha512 must match release files')
  }
  return { body, metadata, downloads, artifact: await resolveReleaseFile(releaseDir, payload.url) }
}

async function developmentFeed(releaseDir, platform, arch, artifact, version, channel) {
  validateVersion(version, channel)
  const file = await selectArtifact(releaseDir, platform, arch, artifact)
  const fileUrl = encodeURIComponent(path.basename(file))
  const sha512 = await checksum(file)
  const metadata = {
    version,
    files: [{ url: fileUrl, sha512, size: (await stat(file)).size }],
    path: fileUrl,
    sha512,
    releaseDate: new Date().toISOString(),
    releaseNotes: '本地下载测试：元数据版本用于触发更新，包内版本不变。仅用于开发版下载，不用于安装验证。',
  }
  return {
    body: Buffer.from(JSON.stringify(metadata, null, 2) + '\n'),
    metadata,
    downloads: new Map([[`/${fileUrl}`, file]]),
    artifact: file,
  }
}

/**
 * @param {{ releaseDir?: string, mode?: string, artifact?: string, platform?: string, arch?: string,
 * version?: string, channel?: string, kbps?: number, log?: (message: string) => void }} [options]
 */
export async function createUpdateServer({
  releaseDir = path.join(desktopDir, 'release'),
  mode = 'production',
  artifact,
  platform = process.platform === 'win32' ? 'win' : 'mac',
  arch = process.arch,
  version,
  channel = 'latest',
  kbps,
  log = logServer,
} = {}) {
  validateTarget(platform, arch)
  if (!CHANNELS.includes(channel)) throw new Error('Use --channel latest|rc|beta')
  if (!['production', 'development'].includes(mode)) throw new Error('Use --mode production|development')
  if (mode === 'production' && (artifact !== undefined || version !== undefined)) {
    throw new Error('Production mode rejects --version and --artifact; use real builder metadata or --mode development')
  }
  if (kbps !== undefined && (!Number.isFinite(kbps) || kbps < 0))
    throw new Error('--kbps must be a non-negative number')
  const manifestPath = `/${channel}${platform === 'mac' ? '-mac' : ''}.yml`
  const feed =
    mode === 'production'
      ? await productionFeed(releaseDir, manifestPath, platform, arch, channel)
      : await developmentFeed(releaseDir, platform, arch, artifact, version, channel)
  const { body, metadata, downloads } = feed
  for (const [url, file] of [...downloads]) {
    try {
      const blockmap = await resolveReleaseFile(releaseDir, path.basename(file) + '.blockmap')
      downloads.set(`${url}.blockmap`, blockmap)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      // Missing blockmaps are fine: electron-updater can fall back to a full download.
    }
  }

  async function handle(request, response, transfer) {
    response.setHeader('Cache-Control', 'no-store')
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end()
      return
    }
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname
    if (pathname === manifestPath) {
      response.writeHead(200, { 'Content-Type': 'application/yaml', 'Content-Length': body.length })
      if (request.method === 'GET') transfer.bytes = body.length
      response.end(request.method === 'HEAD' ? undefined : body)
      return
    }
    const target = downloads.get(pathname)
    if (!target) {
      response.writeHead(404).end()
      return
    }
    const file = await resolveReleaseFile(releaseDir, path.basename(target))
    const targetSize = (await stat(file)).size
    const range = parseRange(request.headers.range, targetSize)
    if (!range) {
      response.writeHead(416, { 'Content-Range': `bytes */${targetSize}` }).end()
      return
    }
    const headers = {
      'Accept-Ranges': 'bytes',
      'Content-Type': file.endsWith('.zip') ? 'application/zip' : 'application/octet-stream',
      'Content-Length': range.end - range.start + 1,
    }
    if (range.partial) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${targetSize}`
    response.writeHead(range.partial ? 206 : 200, headers)
    if (request.method === 'HEAD') {
      response.end()
      return
    }
    const abort = new AbortController()
    const onClose = () => abort.abort()
    response.once('close', onClose)
    const source = createReadStream(file, { start: range.start, end: range.end, highWaterMark: DOWNLOAD_CHUNK_BYTES })
    async function* throttle(chunks) {
      const started = performance.now()
      let nextSendAt = started
      let remainingInBatch = 0
      for await (const chunk of chunks) {
        if (kbps === 0) {
          transfer.bytes += chunk.length
          yield chunk
          continue
        }
        let offset = 0
        while (offset < chunk.length) {
          if (remainingInBatch === 0) {
            const now = performance.now()
            const speed = getDownloadKbps(now - started, kbps)
            remainingInBatch = Math.max(1, Math.floor((speed * 1024 * SEND_INTERVAL_MS) / 1000))
            // Keep timer drift out of the average; discard expired slots after backpressure.
            nextSendAt += SEND_INTERVAL_MS
            if (nextSendAt <= now) nextSendAt = now + SEND_INTERVAL_MS
            await delay(Math.max(0, nextSendAt - performance.now()), undefined, { signal: abort.signal })
          }
          const size = Math.min(remainingInBatch, chunk.length - offset)
          transfer.bytes += size
          yield chunk.subarray(offset, offset + size)
          offset += size
          remainingInBatch -= size
        }
      }
    }
    try {
      await pipeline(source, throttle, response, { signal: abort.signal })
    } finally {
      response.off('close', onClose)
    }
  }

  const server = createServer((request, response) => {
    const started = performance.now()
    const transfer = { bytes: 0 }
    let pathname
    try {
      pathname = new URL(request.url, 'http://127.0.0.1').pathname
    } catch {
      response.writeHead(400).end()
      log('Malformed request URL: status=400')
      return
    }
    response.once('close', () => {
      const outcome = response.writableFinished ? 'complete' : 'interrupted'
      const durationMs = performance.now() - started
      const averageMiBps = durationMs > 0 ? ((transfer.bytes / (1024 * 1024)) * 1000) / durationMs : 0
      log(
        `${request.method} ${pathname} Range=${request.headers.range || '-'} status=${response.statusCode} bytes=${transfer.bytes} durationMs=${Math.round(durationMs)} ${outcome} averageMiBps=${averageMiBps.toFixed(2)}`
      )
    })
    handle(request, response, transfer).catch((error) => {
      if (error.code === 'ABORT_ERR' || error.code === 'ERR_STREAM_PREMATURE_CLOSE') return
      log(`Unable to serve ${pathname}: ${error.stack || error.message}`)
      if (response.destroyed) return
      if (response.headersSent) response.destroy()
      else response.writeHead(500).end('Unable to read update artifact')
    })
  })
  return { server, metadata, manifestPath, artifact: feed.artifact, downloads }
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: 'string', default: 'production' },
      'release-dir': { type: 'string', default: path.join(desktopDir, 'release') },
      port: { type: 'string', default: '5500' },
      platform: { type: 'string', default: process.platform === 'win32' ? 'win' : 'mac' },
      arch: { type: 'string', default: process.arch },
      artifact: { type: 'string' },
      version: { type: 'string' },
      channel: { type: 'string', default: 'latest' },
      kbps: { type: 'string' },
      help: { type: 'boolean' },
    },
  })
  if (values.help) {
    console.log(`pnpm dev:desktop:update-server [--mode production|development] [--release-dir DIR] [--port 5500] [--kbps KiB/s] [--platform mac|win] [--arch arm64|x64] [--channel latest|rc|beta]
Network: default 1–10 MiB/s fluctuation, average 8 MiB/s per 10-second cycle; paced batches every ~50 ms.
--kbps 8192: fixed 8 MiB/s. --kbps 0: unlimited. Manifest responses are not throttled.
Production (default): serves unchanged builder YAML and verified real release files; build a newer real version to test installation.
Development only: [--artifact FILE] [--version X.Y.Z], simulates a newer version for download tests; never use it to verify installation.`)
    return
  }
  const port = Number(values.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('--port must be 1–65535')
  let version = values.version
  if (values.mode === 'development' && !version) {
    const pkg = JSON.parse(await readFile(path.resolve(desktopDir, '../../package.json'), 'utf8'))
    const parts = pkg.version.split('-')[0].split('.').map(Number)
    const nextVersion = `${parts[0]}.${parts[1]}.${parts[2] + 1}`
    version = values.channel === 'latest' ? nextVersion : `${nextVersion}-${values.channel}.1`
  }
  const { server, manifestPath, metadata, downloads } = await createUpdateServer({
    ...values,
    version,
    kbps: values.kbps === undefined ? undefined : Number(values.kbps),
    releaseDir: path.resolve(values['release-dir']),
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  const baseUrl = `http://127.0.0.1:${port}`
  logServer(`Mode: ${values.mode}; release version: ${metadata.version}; platform: ${values.platform}/${values.arch}`)
  const fixedNetwork = Number(values.kbps) === 0 ? 'unlimited' : `fixed ${values.kbps} KiB/s`
  logServer(
    values.kbps === undefined
      ? 'Network: simulated 1–10 MiB/s, cycle average 8 MiB/s; batches every ~50 ms'
      : `Network: ${fixedNetwork}`
  )
  logServer(`Update feed: ${baseUrl}${manifestPath}`)
  for (const [url] of downloads) logServer(`Download: ${baseUrl}${url}`)
  logServer(
    `PURECHAT_DESKTOP_UPDATE_URL=${baseUrl}; packaged applications use their embedded app-update.yml. Ctrl+C stops the server.`
  )
  if (values.mode === 'development')
    logServer('Metadata version only; use pnpm dev:desktop for download tests, not installation.')
  const stop = () => {
    server.close()
    server.closeAllConnections()
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    logServer(`Startup failed: ${error.stack || error.message}`)
    process.exitCode = 1
  })
}
