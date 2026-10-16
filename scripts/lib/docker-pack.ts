import childProcess from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { copyFile, link, mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'

export type PackCompressor = 'auto' | 'gzip' | 'pigz'

export function parsePackCompressor(value = 'auto'): PackCompressor {
  if (value === 'auto' || value === 'gzip' || value === 'pigz') return value
  throw new Error('--compressor 仅支持 auto、gzip 或 pigz')
}

function selectCompressor(compressor: PackCompressor) {
  if (compressor === 'gzip') return 'gzip'
  if (childProcess.spawnSync('pigz', ['--version'], { stdio: 'ignore' }).status === 0) return 'pigz'
  if (compressor === 'pigz') throw new Error('未检测到 pigz，请安装后重试，或使用 --compressor auto')
  return 'gzip'
}

function waitForCommand(child: ChildProcess, label: string) {
  return new Promise<void>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${label} 失败 (${signal ? `signal ${signal}` : `exit ${code}`})`))
    })
  })
}

async function saveImage(image: string, platform: string, destFile: string, cwd: string, compressor: PackCompressor) {
  const selected = selectCompressor(compressor)
  console.log(`导出 ${image}（${platform}，${selected === 'pigz' ? 'pigz 多核' : 'gzip'} 快速压缩）`)
  const docker = childProcess.spawn('docker', ['save', '--platform', platform, image], {
    cwd,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const gzip =
    selected === 'pigz' ? childProcess.spawn('pigz', ['-1', '-c'], { stdio: ['pipe', 'pipe', 'inherit'] }) : undefined
  const commands = [waitForCommand(docker, 'docker save')]
  if (gzip) commands.push(waitForCommand(gzip, 'pigz'))
  const output = createWriteStream(destFile, { flags: 'wx' })
  const streams = gzip
    ? [pipeline(docker.stdout, gzip.stdin), pipeline(gzip.stdout, output)]
    : [pipeline(docker.stdout, createGzip({ level: 1 }), output)]
  const pending = [...commands, ...streams]
  try {
    await Promise.all(pending)
  } catch (error) {
    docker.kill()
    gzip?.kill()
    await Promise.allSettled(pending)
    throw error
  }
}

async function hasArchive(filename: string) {
  try {
    const info = await stat(filename)
    return info.isFile() && info.size > 0
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

/** 只在镜像 ID、tag、平台均一致时复用；缓存文件原子替换，staging 用硬链接避免重复拷贝。 */
export async function exportPackImage(options: {
  cacheDir: string
  compressor: PackCompressor
  cwd: string
  destFile: string
  image: string
  imageId: string
  platform: string
  useCache: boolean
}) {
  const { compressor, cwd, destFile, image, imageId, platform, useCache } = options
  const key = createHash('sha256')
    .update(JSON.stringify([image, imageId, platform, 'gzip-1-v1']))
    .digest('hex')
  const cacheDir = path.join(options.cacheDir, platform.replaceAll(/[^a-zA-Z0-9_-]/g, '-'))
  const archive = path.join(cacheDir, `${key}.tar.gz`)
  await mkdir(cacheDir, { recursive: true })
  const cacheHit = useCache && (await hasArchive(archive))
  if (!cacheHit) {
    const temporary = `${archive}.${randomBytes(6).toString('hex')}.tmp`
    try {
      await saveImage(image, platform, temporary, cwd, compressor)
      const current = childProcess.spawnSync('docker', ['image', 'inspect', '--format', '{{.Id}}', image], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      if (current.status !== 0 || current.stdout.trim() !== imageId) {
        throw new Error(`${image} 在导出期间发生变化或无法读取，请重新打包`)
      }
      await rename(temporary, archive)
    } finally {
      await rm(temporary, { force: true })
    }
  }
  await mkdir(path.dirname(destFile), { recursive: true })
  try {
    await link(archive, destFile)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (!code || !['EXDEV', 'EPERM', 'ENOTSUP', 'EACCES'].includes(code)) throw error
    await copyFile(archive, destFile)
  }
  // 每个平台仅保留最近一次成功导出的镜像，避免缓存持续占用磁盘。
  for (const file of await readdir(cacheDir)) {
    if (file !== path.basename(archive) && /^[a-f0-9]{64}\.tar\.gz$/.test(file)) {
      await rm(path.join(cacheDir, file), { force: true })
    }
  }
  return { cacheHit }
}
