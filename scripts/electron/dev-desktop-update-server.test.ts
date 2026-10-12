// @vitest-environment node
import { createHash } from 'node:crypto'
import { mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createUpdateServer, getDownloadKbps, parseRange, selectArtifact } from './dev-desktop-update-server.mjs'

let releaseDir: string
const payload = Buffer.from('local update payload')
const artifact = 'PureChat-0.2.0-arm64.zip'

beforeEach(async () => {
  releaseDir = await realpath(await mkdtemp(path.join(tmpdir(), 'purechat-update-test-')))
  await writeFile(path.join(releaseDir, artifact), payload)
  await writeFile(path.join(releaseDir, `${artifact}.blockmap`), 'blockmap')
})

afterEach(async () => {
  await rm(releaseDir, { recursive: true, force: true })
})

describe('desktop local update server', () => {
  it('models smooth 1–10 MiB/s variation with a cycle mean of 8 and preserves fixed/unlimited rates', () => {
    const speeds = Array.from({ length: 200 }, (_, tick) => getDownloadKbps(tick * 50) / 1024)
    expect(Math.min(...speeds)).toBe(1)
    expect(Math.max(...speeds)).toBe(10)
    expect(speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length).toBeCloseTo(8, 8)
    expect(getDownloadKbps(1500)).toBe(9.5 * 1024)
    expect(getDownloadKbps(10000)).toBe(getDownloadKbps(0))
    expect(getDownloadKbps(5000, 8192)).toBe(8192)
    expect(getDownloadKbps(5000, 0)).toBe(0)
  })

  it('selects ZIP/NSIS artifacts and rejects manual installers and directory traversal', async () => {
    expect(await selectArtifact(releaseDir, 'mac', 'arm64')).toBe(path.join(releaseDir, artifact))
    await expect(selectArtifact(releaseDir, 'mac', 'x64')).rejects.toThrow('No update artifact')
    await expect(selectArtifact(releaseDir, 'mac', 'arm64', '../PureChat-0.2.0-arm64.zip')).rejects.toThrow('filename')
    await expect(selectArtifact(releaseDir, 'mac', 'arm64', 'PureChat.dmg')).rejects.toThrow('ZIP')
    await expect(selectArtifact(releaseDir, 'win', 'x64', 'PureChat-portable.exe')).rejects.toThrow('NSIS')
    await writeFile(path.join(releaseDir, 'PureChat-0.2.0-setup.exe'), payload)
    expect(await selectArtifact(releaseDir, 'win', 'x64')).toContain('-setup.exe')
  })

  it('serves verifiable manifests, full/range downloads and only the selected artifacts', async () => {
    await writeFile(path.join(releaseDir, 'builder-debug.yml'), 'private build data')
    const { server, manifestPath, metadata } = await createUpdateServer({
      mode: 'development',
      platform: 'mac',
      arch: 'arm64',
      log: () => undefined,
      releaseDir,
      artifact,
      version: '0.2.1',
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing server address')
    const baseUrl = `http://127.0.0.1:${address.port}`
    try {
      expect(manifestPath).toBe('/latest-mac.yml')
      const manifest = await fetch(`${baseUrl}${manifestPath}?noCache=1`)
      expect(manifest.headers.get('cache-control')).toBe('no-store')
      expect(await manifest.json()).toEqual(metadata)
      expect(metadata.files[0].sha512).toBe(createHash('sha512').update(payload).digest('base64'))

      const full = await fetch(`${baseUrl}/${artifact}`)
      expect(Buffer.from(await full.arrayBuffer())).toEqual(payload)
      const head = await fetch(`${baseUrl}/${artifact}`, { method: 'HEAD' })
      expect(head.headers.get('content-length')).toBe(String(payload.length))
      expect(await head.text()).toBe('')
      const range = await fetch(`${baseUrl}/${artifact}`, { headers: { Range: 'bytes=1-5' } })
      expect(range.status).toBe(206)
      expect(range.headers.get('content-range')).toBe(`bytes 1-5/${payload.length}`)
      expect(Buffer.from(await range.arrayBuffer())).toEqual(payload.subarray(1, 6))
      const invalid = await fetch(`${baseUrl}/${artifact}`, { headers: { Range: 'bytes=999-' } })
      expect(invalid.status).toBe(416)
      expect((await fetch(`${baseUrl}/${artifact}.blockmap`)).status).toBe(200)
      expect((await fetch(`${baseUrl}/builder-debug.yml`)).status).toBe(404)
      expect((await fetch(`${baseUrl}${manifestPath}`, { method: 'POST' })).status).toBe(405)
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    }
  })

  it('keeps prerelease versions aligned with their channel', async () => {
    const { manifestPath } = await createUpdateServer({
      mode: 'development',
      platform: 'mac',
      arch: 'arm64',
      log: () => undefined,
      releaseDir,
      artifact,
      version: '0.2.1-rc.1',
      channel: 'rc',
    })
    expect(manifestPath).toBe('/rc-mac.yml')
    await expect(
      createUpdateServer({
        mode: 'development',
        platform: 'mac',
        arch: 'arm64',
        log: () => undefined,
        releaseDir,
        artifact,
        version: '0.2.1-beta.1',
        channel: 'rc',
      })
    ).rejects.toThrow('Version must match channel')
  })

  it('handles open-ended/suffix ranges and rejects multipart or empty ranges', () => {
    expect(parseRange('bytes=2-', 10)).toEqual({ start: 2, end: 9, partial: true })
    expect(parseRange('bytes=-3', 10)).toEqual({ start: 7, end: 9, partial: true })
    expect(parseRange('bytes=-0', 10)).toBeNull()
    expect(parseRange('bytes=5-2', 10)).toBeNull()
    expect(parseRange('bytes=0-1,5-6', 10)).toBeNull()
  })

  it('paces a fixed-rate download across multiple delivery windows without altering its bytes', async () => {
    const data = Buffer.alloc(4 * 1024 * 1024, 7)
    await writeFile(path.join(releaseDir, artifact), data)
    const log = vi.fn()
    const { server } = await createUpdateServer({
      releaseDir,
      mode: 'development',
      platform: 'mac',
      arch: 'arm64',
      version: '0.2.1',
      kbps: 8192,
      log,
    })
    const baseUrl = await listen(server)
    try {
      const started = performance.now()
      const response = await fetch(`${baseUrl}/${artifact}`)
      if (!response.body) throw new Error('Missing download body')
      const hash = createHash('sha512')
      let transferred = 0
      let previousWindow = 0
      let deliveryWindows = 0
      const reader = response.body.getReader()
      let next = await reader.read()
      while (!next.done) {
        const elapsed = performance.now() - started
        if (elapsed - previousWindow >= 25) {
          previousWindow = elapsed
          deliveryWindows += 1
        }
        hash.update(next.value)
        transferred += next.value.byteLength
        next = await reader.read()
      }
      reader.releaseLock()
      expect(transferred).toBe(data.length)
      expect(hash.digest('base64')).toBe(createHash('sha512').update(data).digest('base64'))
      expect(performance.now() - started).toBeGreaterThanOrEqual(400)
      expect(deliveryWindows).toBeGreaterThanOrEqual(5)
      expect(log).toHaveBeenCalledWith(expect.stringContaining('averageMiBps='))
    } finally {
      await close(server)
    }
  })
})

async function writeReleaseManifest() {
  const sha512 = createHash('sha512').update(payload).digest('base64')
  const dmg = 'PureChat-0.2.0-arm64.dmg'
  await writeFile(path.join(releaseDir, dmg), payload)
  const text = `version: 0.2.0
files:
  - url: ${artifact}
    sha512: ${sha512}
    size: ${payload.length}
  - url: ${dmg}
    sha512: ${sha512}
    size: ${payload.length}
path: ${artifact}
sha512: ${sha512}
releaseDate: '2026-10-12T03:04:59.149Z'
`
  await writeFile(path.join(releaseDir, 'latest-mac.yml'), text)
  return text
}

const productionOptions = () => ({ releaseDir, platform: 'mac', arch: 'arm64', kbps: 0, log: vi.fn() })

async function listen(server: import('node:http').Server) {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing server address')
  return `http://127.0.0.1:${address.port}`
}

async function close(server: import('node:http').Server) {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
}

describe('production update feed', () => {
  it('defaults to unchanged builder YAML and serves both update and manual installers', async () => {
    const manifest = await writeReleaseManifest()
    const options = productionOptions()
    const { server, metadata } = await createUpdateServer(options)
    const baseUrl = await listen(server)
    try {
      expect(metadata.version).toBe('0.2.0')
      expect(await (await fetch(`${baseUrl}/latest-mac.yml?noCache=1`)).text()).toBe(manifest)
      const download = await fetch(`${baseUrl}/PureChat-0.2.0-arm64.dmg`)
      expect(Buffer.from(await download.arrayBuffer())).toEqual(payload)
      const range = await fetch(`${baseUrl}/${artifact}`, { headers: { Range: 'bytes=1-5' } })
      expect(range.status).toBe(206)
      expect(Buffer.from(await range.arrayBuffer())).toEqual(payload.subarray(1, 6))
      expect((await fetch(`${baseUrl}/${artifact}`, { method: 'HEAD' })).headers.get('content-length')).toBe(
        String(payload.length)
      )
      expect((await fetch(`${baseUrl}/builder-debug.yml`)).status).toBe(404)
      expect((await fetch(`${baseUrl}/rc-mac.yml`)).status).toBe(404)
      expect(options.log).toHaveBeenCalledWith(
        expect.stringMatching(/GET .*Range=bytes=1-5 status=206 bytes=5 durationMs=\d+ complete/)
      )
    } finally {
      await close(server)
    }
  })

  it('rejects simulated versions, missing metadata, wrong channel and architecture', async () => {
    await expect(createUpdateServer({ ...productionOptions(), version: '0.2.1' })).rejects.toThrow('rejects --version')
    await expect(createUpdateServer({ ...productionOptions(), artifact })).rejects.toThrow('rejects --version')
    await expect(createUpdateServer(productionOptions())).rejects.toThrow('ENOENT')
    await writeReleaseManifest()
    await expect(createUpdateServer({ ...productionOptions(), arch: 'x64' })).rejects.toThrow('mac/x64')
    await writeFile(path.join(releaseDir, 'rc-mac.yml'), '{"version":"0.2.0","files":[]}')
    await expect(createUpdateServer({ ...productionOptions(), channel: 'rc' })).rejects.toThrow(
      'Version must match channel'
    )
  })

  it('rejects malformed YAML, missing files, size/checksum mismatches and conflicting legacy fields', async () => {
    await writeFile(path.join(releaseDir, 'latest-mac.yml'), 'files: [')
    await expect(createUpdateServer(productionOptions())).rejects.toThrow()
    const manifest = await writeReleaseManifest()
    await writeFile(
      path.join(releaseDir, 'latest-mac.yml'),
      manifest.replaceAll(artifact, 'PureChat-missing-arm64.zip')
    )
    await expect(createUpdateServer(productionOptions())).rejects.toThrow('ENOENT')
    await writeFile(path.join(releaseDir, 'latest-mac.yml'), manifest.replace(`size: ${payload.length}`, 'size: 999'))
    await expect(createUpdateServer(productionOptions())).rejects.toThrow('size mismatch')
    await writeFile(path.join(releaseDir, 'latest-mac.yml'), manifest.replace(/sha512: \S+/, 'sha512: wrong'))
    await expect(createUpdateServer(productionOptions())).rejects.toThrow('SHA-512 mismatch')
    await writeFile(path.join(releaseDir, 'latest-mac.yml'), manifest.replace(`path: ${artifact}`, 'path: missing.zip'))
    await expect(createUpdateServer(productionOptions())).rejects.toThrow('Legacy path/sha512')
  })

  it('rejects URLs, encoded traversal and symlinks outside the release directory', async () => {
    const manifest = await writeReleaseManifest()
    for (const unsafe of [
      'https://example.com/update.zip',
      '../update.zip',
      '%2e%2e%2fupdate.zip',
      'file:///tmp/update.zip',
    ]) {
      await writeFile(path.join(releaseDir, 'latest-mac.yml'), manifest.replaceAll(artifact, JSON.stringify(unsafe)))
      await expect(createUpdateServer(productionOptions())).rejects.toThrow('local filename')
    }
    const outside = await mkdtemp(path.join(tmpdir(), 'purechat-outside-'))
    try {
      await writeFile(path.join(outside, artifact), payload)
      await rm(path.join(releaseDir, artifact))
      await symlink(path.join(outside, artifact), path.join(releaseDir, artifact))
      await writeFile(path.join(releaseDir, 'latest-mac.yml'), manifest)
      await expect(createUpdateServer(productionOptions())).rejects.toThrow('symlink escapes')
      await rm(path.join(releaseDir, artifact))
      await writeFile(path.join(releaseDir, artifact), payload)
      await rm(path.join(releaseDir, `${artifact}.blockmap`))
      await symlink(path.join(outside, artifact), path.join(releaseDir, `${artifact}.blockmap`))
      await expect(createUpdateServer(productionOptions())).rejects.toThrow('symlink escapes')
    } finally {
      await rm(outside, { recursive: true, force: true })
    }
  })

  it('serves Windows NSIS metadata and requires the current x64 package architecture', async () => {
    const name = 'PureChat-0.2.1-setup.exe'
    await writeFile(path.join(releaseDir, name), payload)
    await writeFile(
      path.join(releaseDir, 'latest.yml'),
      JSON.stringify({
        version: '0.2.1',
        files: [{ url: name, size: payload.length, sha512: createHash('sha512').update(payload).digest('base64') }],
      })
    )
    const { server, manifestPath } = await createUpdateServer({ ...productionOptions(), platform: 'win', arch: 'x64' })
    expect(manifestPath).toBe('/latest.yml')
    const baseUrl = await listen(server)
    try {
      expect(Buffer.from(await (await fetch(`${baseUrl}/${name}`)).arrayBuffer())).toEqual(payload)
    } finally {
      await close(server)
    }
    await expect(createUpdateServer({ ...productionOptions(), platform: 'win', arch: 'arm64' })).rejects.toThrow(
      'x64 only'
    )
  })

  it('reports interrupted downloads and remains available after client cancellation', async () => {
    const log = vi.fn()
    await writeFile(path.join(releaseDir, artifact), Buffer.alloc(256 * 1024))
    const { server } = await createUpdateServer({
      ...productionOptions(),
      mode: 'development',
      version: '0.2.1',
      artifact,
      kbps: 512,
      log,
    })
    const baseUrl = await listen(server)
    try {
      const abort = new AbortController()
      const download = await fetch(`${baseUrl}/${artifact}`, { signal: abort.signal })
      await download.body?.getReader().read()
      abort.abort()
      await vi.waitFor(() => expect(log).toHaveBeenCalledWith(expect.stringContaining('interrupted')))
      expect((await fetch(`${baseUrl}/latest-mac.yml`)).status).toBe(200)
    } finally {
      await close(server)
    }
  })

  it('logs read failures without losing subsequent manifest requests', async () => {
    await writeReleaseManifest()
    const options = productionOptions()
    const { server } = await createUpdateServer(options)
    const baseUrl = await listen(server)
    try {
      await rm(path.join(releaseDir, artifact))
      expect((await fetch(`${baseUrl}/${artifact}`)).status).toBe(500)
      expect(options.log).toHaveBeenCalledWith(expect.stringContaining('Unable to serve'))
      expect((await fetch(`${baseUrl}/latest-mac.yml`)).status).toBe(200)
    } finally {
      await close(server)
    }
  })
})
