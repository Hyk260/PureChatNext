// @vitest-environment node
import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { buffer } from 'node:stream/consumers'

import { S3Client } from '@aws-sdk/client-s3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { uploadDesktopAsset } from '../desktop-upload'

const PART_SIZE = 8 * 1024 * 1024
const config = { bucket: 'test-123', setAcl: false }
type Request = { method: string; url: URL; headers: IncomingMessage['headers']; bytes: Buffer }
let directory: string
let server: Server
let client: S3Client
let requests: Request[]
let failure: 'retry' | 'denied' | 'stall' | undefined

async function respond(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url!, 'http://localhost')
  const bytes = await buffer(request)
  requests.push({ method: request.method!, url, headers: request.headers, bytes })
  const part = url.searchParams.get('partNumber')
  response.setHeader('content-type', 'application/xml')
  if (request.method === 'POST' && url.searchParams.has('uploads')) {
    response.end('<InitiateMultipartUploadResult><UploadId>upload-1</UploadId></InitiateMultipartUploadResult>')
  } else if (request.method === 'PUT' && part) {
    if (failure === 'stall') return
    if (part === '2' && failure) {
      const code = failure === 'retry' ? 'ServiceUnavailable' : 'AccessDenied'
      response.statusCode = failure === 'retry' ? 503 : 403
      if (failure === 'retry') failure = undefined
      response.end(`<Error><Code>${code}</Code><Message>test failure</Message></Error>`)
      return
    }
    response.setHeader('ETag', `"part-${part}"`)
    response.end()
  } else if (request.method === 'POST') {
    response.end('<CompleteMultipartUploadResult><ETag>"complete"</ETag></CompleteMultipartUploadResult>')
  } else {
    response.statusCode = request.method === 'DELETE' ? 204 : 200
    response.end()
  }
}

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'desktop-upload-test-'))
  requests = []
  failure = undefined
  server = createServer((request, response) => {
    respond(request, response).catch((error) => response.destroy(error))
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing test server address')
  client = new S3Client({
    endpoint: `http://127.0.0.1:${address.port}`,
    region: 'ap-shanghai',
    forcePathStyle: true,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    expectContinueHeader: false,
    maxAttempts: 1,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
  client?.destroy()
  server?.closeAllConnections()
  if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()))
  await rm(directory, { recursive: true, force: true })
})

async function asset(size: number) {
  const bytes = Buffer.alloc(size, 0x5a)
  const file = path.join(directory, 'installer.exe')
  await writeFile(file, bytes)
  return { bytes, file, name: 'installer.exe', size, sha512: createHash('sha512').update(bytes).digest('base64') }
}

describe('desktop upload over HTTP', () => {
  it('sends small files with fixed length, a payload signature and an integrity checksum', async () => {
    const file = await asset(128 * 1024)
    await uploadDesktopAsset(client, config, file, 'desktop/installer.exe', vi.fn())
    expect(requests).toHaveLength(1)
    expect(requests[0].bytes).toEqual(file.bytes)
    expect(requests[0].headers).toMatchObject({
      'content-length': String(file.size),
      'content-md5': createHash('md5').update(file.bytes).digest('base64'),
      'x-amz-content-sha256': createHash('sha256').update(file.bytes).digest('hex'),
      'x-amz-meta-sha512': file.sha512,
    })
    expect(requests[0].headers.expect).toBeUndefined()
    expect(requests[0].headers['transfer-encoding']).toBeUndefined()
  })

  it('retries only a failed part, then completes the parts in order with matching bytes', async () => {
    failure = 'retry'
    const file = await asset(PART_SIZE + 64 * 1024)
    const log = vi.fn()
    await uploadDesktopAsset(client, config, file, 'desktop/installer.exe', log)
    const parts = requests.filter(({ method }) => method === 'PUT')
    expect(parts.map(({ url }) => url.searchParams.get('partNumber'))).toEqual(['1', '2', '2'])
    expect(Buffer.concat([parts[0].bytes, parts[2].bytes]).equals(file.bytes)).toBe(true)
    for (const part of parts) {
      expect(part.headers['content-length']).toBe(String(part.bytes.length))
      expect(part.headers['content-md5']).toBe(createHash('md5').update(part.bytes).digest('base64'))
      expect(part.headers['x-amz-content-sha256']).toBe(createHash('sha256').update(part.bytes).digest('hex'))
      expect(part.headers.expect).toBeUndefined()
      expect(part.headers['transfer-encoding']).toBeUndefined()
    }
    expect(requests[0].headers['x-amz-meta-sha512']).toBe(file.sha512)
    expect(requests.at(-1)?.bytes.toString()).toContain(
      '<Part><ETag>&quot;part-1&quot;</ETag><PartNumber>1</PartNumber></Part><Part><ETag>&quot;part-2&quot;</ETag><PartNumber>2</PartNumber></Part>'
    )
    expect(log).toHaveBeenCalledWith(`COS 已确认上传: installer.exe ${file.size}/${file.size} bytes`)
    expect(requests.some(({ method }) => method === 'DELETE')).toBe(false)
  })

  it('aborts an incomplete upload immediately on a permanent error', async () => {
    failure = 'denied'
    const file = await asset(PART_SIZE + 1)
    await expect(uploadDesktopAsset(client, config, file, 'desktop/installer.exe', vi.fn())).rejects.toThrow('test failure')
    expect(requests.filter(({ method }) => method === 'PUT')).toHaveLength(2)
    expect(requests.at(-1)?.method).toBe('DELETE')
    expect(requests.filter(({ method }) => method === 'POST')).toHaveLength(1)
  })

  it('cancels stalled requests, bounds retries and cleans up uploaded parts', async () => {
    failure = 'stall'
    const timeout = AbortSignal.timeout.bind(AbortSignal)
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => timeout(ms === 120_000 ? 200 : ms))
    const file = await asset(PART_SIZE + 1)
    await expect(uploadDesktopAsset(client, config, file, 'desktop/installer.exe', vi.fn())).rejects.toThrow()
    expect(requests.filter(({ method }) => method === 'PUT')).toHaveLength(3)
    expect(requests.at(-1)?.method).toBe('DELETE')
    expect(requests.filter(({ method }) => method === 'POST')).toHaveLength(1)
  }, 15_000)
})
