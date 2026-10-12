// @vitest-environment node
import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createUpdateServer, parseRange, selectArtifact } from './dev-desktop-update-server.mjs'

let releaseDir: string
const payload = Buffer.from('local update payload')
const artifact = 'PureChat-0.2.0-arm64.zip'

beforeEach(async () => {
  releaseDir = await mkdtemp(path.join(tmpdir(), 'purechat-update-test-'))
  await writeFile(path.join(releaseDir, artifact), payload)
  await writeFile(path.join(releaseDir, `${artifact}.blockmap`), 'blockmap')
})

afterEach(async () => {
  await rm(releaseDir, { recursive: true, force: true })
})

describe('desktop local update server', () => {
  it('selects ZIP/NSIS artifacts and rejects manual installers and directory traversal', async () => {
    expect(await selectArtifact(releaseDir, 'mac', 'arm64')).toBe(path.join(releaseDir, artifact))
    await expect(selectArtifact(releaseDir, 'mac', 'x64')).rejects.toThrow('No update artifact')
    await expect(selectArtifact(releaseDir, 'mac', 'arm64', '../secret.zip')).rejects.toThrow('filename')
    await expect(selectArtifact(releaseDir, 'mac', 'arm64', 'PureChat.dmg')).rejects.toThrow('ZIP')
    await expect(selectArtifact(releaseDir, 'win', 'x64', 'PureChat-portable.exe')).rejects.toThrow('NSIS')
    await writeFile(path.join(releaseDir, 'PureChat-0.2.0-setup.exe'), payload)
    expect(await selectArtifact(releaseDir, 'win', 'x64')).toContain('-setup.exe')
  })

  it('serves verifiable manifests, full/range downloads and only the selected artifacts', async () => {
    await writeFile(path.join(releaseDir, 'builder-debug.yml'), 'private build data')
    const { server, manifestPath, metadata } = await createUpdateServer({
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
    const { manifestPath } = await createUpdateServer({ releaseDir, artifact, version: '0.2.1-rc.1', channel: 'rc' })
    expect(manifestPath).toBe('/rc-mac.yml')
    await expect(createUpdateServer({ releaseDir, artifact, version: '0.2.1-beta.1', channel: 'rc' })).rejects.toThrow(
      'Version must match channel'
    )
  })

  it('handles open-ended/suffix ranges and rejects multipart or empty ranges', () => {
    expect(parseRange('bytes=2-', 10)).toEqual({ start: 2, end: 9, partial: true })
    expect(parseRange('bytes=-3', 10)).toEqual({ start: 7, end: 9, partial: true })
    expect(parseRange('bytes=-0', 10)).toBeNull()
    expect(parseRange('bytes=5-2', 10)).toBeNull()
    expect(parseRange('bytes=0-1,5-6', 10)).toBeNull()
  })
})
