// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { extractFiles, parseString } from '../src/utils/parser-utils'
import type { ExtractedFile } from '../src/utils/parser-utils'

const extractionLimits = {
  maxBytesPerFile: 1024,
  maxEntries: 16,
  maxFiles: 4,
  maxTotalBytes: 2048,
}

describe('parser-utils', () => {
  describe('parseString', () => {
    it('should parse valid XML string into XMLDocument', () => {
      const xml = '<root><item id="1">hello</item></root>'
      const doc = parseString(xml)

      // The parsed document should contain the root and item node
      const root = (doc as any).getElementsByTagName('root')[0]
      expect(root).toBeDefined()
      const item = (doc as any).getElementsByTagName('item')[0]
      expect(item).toBeDefined()
      expect(item.getAttribute('id')).toBe('1')
      expect(item.textContent).toBe('hello')
    })
  })

  describe('extractFiles', () => {
    beforeEach(() => {
      vi.resetModules()
    })

    it('should reject on invalid input type', async () => {
      // @ts-expect-error intentional wrong type
      await expect(extractFiles(123, () => true, extractionLimits)).rejects.toThrow(
        '[file-loaders]: Expected a Buffer or a readable file path'
      )
    })

    it('should handle corrupted file error with Buffer input', async () => {
      vi.doMock('yauzl', () => ({
        default: {
          fromBuffer: (_buf: Buffer, _opts: any, cb: (err: any) => void) => {
            cb(new Error('corrupted'))
          },
        },
      }))

      const { extractFiles: mockedExtractFiles } = await import('../src/utils/parser-utils')

      await expect(mockedExtractFiles(Buffer.from('corrupted'), () => true, extractionLimits)).rejects.toThrow()
    })

    it('should read entries via yauzl.fromBuffer and filter matches', async () => {
      // Arrange: build a fake zipfile object with two file entries and one directory
      const entryHandlers: Record<string, (cb: () => void) => void> = {}
      const listeners: Record<string, Function[]> = { entry: [], end: [], error: [] }
      let idx = 0
      const sequence = [{ fileName: 'folder/' }, { fileName: 'keep.txt' }, { fileName: 'skip.bin' }]

      const emit = (name: string, payload?: any) => (listeners[name] || []).forEach((fn) => fn(payload))

      const fakeZipfile = {
        readEntry: vi.fn().mockImplementation(() => {
          queueMicrotask(() => {
            if (idx < sequence.length) {
              const entry = sequence[idx++]
              emit('entry', entry as any)
            } else {
              emit('end')
            }
          })
        }),
        openReadStream: vi.fn((entry: any, cb: (err: any, stream?: any) => void) => {
          if (entry.fileName === 'keep.txt') {
            // Provide a minimal readable stream compatible with concat-stream
            const chunks: any[] = []
            const stream = {
              pipe(destination: any) {
                // emulate piping to concat-stream writable
                if (typeof destination.end === 'function') {
                  destination.end(Buffer.from('hello world'))
                }
                return destination
              },
              on: vi.fn(),
            }
            cb(null, stream)
          } else if (entry.fileName === 'skip.bin') {
            // This entry should be skipped by filter, so not invoked
            cb(null, undefined as any)
          }
        }),
        on: vi.fn((evt: string, handler: Function) => {
          listeners[evt] = listeners[evt] || []
          listeners[evt].push(handler)
        }),
        close: vi.fn(),
      } as any

      // Mock yauzl.fromBuffer to pass back our fake zipfile
      vi.doMock('yauzl', () => ({
        default: {
          fromBuffer: (_buf: Buffer, _opts: any, cb: (err: any, zf?: any) => void) => cb(null, fakeZipfile),
          open: vi.fn(),
        },
      }))

      // Re-import module to use mocked yauzl
      const { extractFiles: mockedExtractFiles } = await import('../src/utils/parser-utils')

      const files: ExtractedFile[] = await mockedExtractFiles(
        Buffer.from('zip'),
        (name) => name.endsWith('.txt'),
        extractionLimits
      )
      expect(files).toEqual([{ path: 'keep.txt', content: 'hello world' }])
    })

    it('should reject an entry whose declared uncompressed size exceeds its limit', async () => {
      const listeners: Record<string, Function[]> = { entry: [], end: [], error: [] }
      const fakeZipfile = {
        readEntry: vi.fn().mockImplementation(() => {
          queueMicrotask(() => listeners.entry.forEach((handler) => handler({ fileName: 'slide.xml', uncompressedSize: 5 })))
        }),
        openReadStream: vi.fn(),
        on: vi.fn((event: string, handler: Function) => listeners[event].push(handler)),
        close: vi.fn(),
      }
      vi.doMock('yauzl', () => ({
        default: { fromBuffer: (_buf: Buffer, _opts: any, callback: (err: any, zipfile: any) => void) => callback(null, fakeZipfile) },
      }))
      const { extractFiles: mockedExtractFiles } = await import('../src/utils/parser-utils')

      await expect(
        mockedExtractFiles(Buffer.from('zip'), () => true, { ...extractionLimits, maxBytesPerFile: 4 })
      ).rejects.toThrow('ZIP extracted file limit exceeded')
      expect(fakeZipfile.openReadStream).not.toHaveBeenCalled()
    })

    it('should reject a stream that exceeds its declared uncompressed size', async () => {
      const listeners: Record<string, Function[]> = { entry: [], end: [], error: [] }
      let onData: (chunk: Buffer) => void = () => undefined
      const stream = {
        destroy: vi.fn(),
        on: vi.fn((event: string, handler: (chunk: Buffer) => void) => {
          if (event === 'data') onData = handler
        }),
        pipe: (destination: { end: (chunk: Buffer) => void }) => {
          const oversizedChunk = Buffer.alloc(5)
          onData(oversizedChunk)
          destination.end(oversizedChunk)
          return destination
        },
      }
      const fakeZipfile = {
        readEntry: vi.fn().mockImplementation(() => {
          queueMicrotask(() =>
            listeners.entry.forEach((handler) => handler({ fileName: 'slide.xml', uncompressedSize: 1 }))
          )
        }),
        openReadStream: vi.fn((_entry: unknown, callback: (err: null, readStream: typeof stream) => void) =>
          callback(null, stream)
        ),
        on: vi.fn((event: string, handler: Function) => listeners[event].push(handler)),
        close: vi.fn(),
      }
      vi.doMock('yauzl', () => ({
        default: { fromBuffer: (_buf: Buffer, _opts: any, callback: (err: any, zipfile: any) => void) => callback(null, fakeZipfile) },
      }))
      const { extractFiles: mockedExtractFiles } = await import('../src/utils/parser-utils')

      await expect(
        mockedExtractFiles(Buffer.from('zip'), () => true, { ...extractionLimits, maxBytesPerFile: 4 })
      ).rejects.toThrow('ZIP extracted byte limit exceeded')
      expect(stream.destroy).toHaveBeenCalledOnce()
      expect(fakeZipfile.close).toHaveBeenCalledOnce()
    })

    it('should open zip by file path when input is string', async () => {
      const listeners: Record<string, Function[]> = { entry: [], end: [], error: [] }
      let idx = 0
      const entries = [{ fileName: 'keep.txt' }]
      const emit2 = (name: string, payload?: any) => (listeners[name] || []).forEach((fn) => fn(payload))

      const fakeZipfile = {
        readEntry: vi.fn().mockImplementation(() => {
          queueMicrotask(() => {
            if (idx < entries.length) {
              const entry = entries[idx++]
              emit2('entry', entry as any)
            } else {
              emit2('end')
            }
          })
        }),
        openReadStream: vi.fn((entry: any, cb: (err: any, stream?: any) => void) => {
          const stream = {
            pipe(destination: any) {
              if (typeof destination.end === 'function') {
                destination.end(Buffer.from('A'))
              }
              return destination
            },
            on: vi.fn(),
          }
          cb(null, stream)
        }),
        on: vi.fn((evt: string, handler: Function) => {
          listeners[evt] = listeners[evt] || []
          listeners[evt].push(handler)
        }),
        close: vi.fn(),
      } as any

      vi.doMock('yauzl', () => ({
        default: {
          fromBuffer: vi.fn(),
          open: (_path: string, _opts: any, cb: (err: any, zf?: any) => void) => cb(null, fakeZipfile),
        },
      }))

      const { extractFiles: mockedExtractFiles } = await import('../src/utils/parser-utils')

      const files = await mockedExtractFiles('/tmp/file.zip', (name) => name === 'keep.txt', extractionLimits)
      expect(files).toEqual([{ path: 'keep.txt', content: 'A' }])
    })

    it('should handle openReadStream error', async () => {
      const listeners: Record<string, Function[]> = { entry: [], end: [], error: [] }
      const emit = (name: string, payload?: any) => (listeners[name] || []).forEach((fn) => fn(payload))

      const fakeZipfile = {
        readEntry: vi.fn().mockImplementation(() => {
          queueMicrotask(() => emit('entry', { fileName: 'test.txt' }))
        }),
        openReadStream: vi.fn((entry: any, cb: (err: any, stream?: any) => void) => {
          cb(new Error('Failed to open stream'))
        }),
        on: vi.fn((evt: string, handler: Function) => {
          listeners[evt] = listeners[evt] || []
          listeners[evt].push(handler)
        }),
        close: vi.fn(),
      } as any

      vi.doMock('yauzl', () => ({
        default: {
          fromBuffer: (_buf: Buffer, _opts: any, cb: (err: any, zf?: any) => void) => cb(null, fakeZipfile),
        },
      }))

      const { extractFiles: mockedExtractFiles } = await import('../src/utils/parser-utils')

      await expect(mockedExtractFiles(Buffer.from('zip'), () => true, extractionLimits)).rejects.toThrow(
        'Failed to open stream'
      )
    })

    it('should handle null readStream', async () => {
      const listeners: Record<string, Function[]> = { entry: [], end: [], error: [] }
      const emit = (name: string, payload?: any) => (listeners[name] || []).forEach((fn) => fn(payload))

      const fakeZipfile = {
        readEntry: vi.fn().mockImplementation(() => {
          queueMicrotask(() => emit('entry', { fileName: 'test.txt' }))
        }),
        openReadStream: vi.fn((entry: any, cb: (err: any, stream?: any) => void) => {
          cb(null, null) // readStream is null
        }),
        on: vi.fn((evt: string, handler: Function) => {
          listeners[evt] = listeners[evt] || []
          listeners[evt].push(handler)
        }),
        close: vi.fn(),
      } as any

      vi.doMock('yauzl', () => ({
        default: {
          fromBuffer: (_buf: Buffer, _opts: any, cb: (err: any, zf?: any) => void) => cb(null, fakeZipfile),
        },
      }))

      const { extractFiles: mockedExtractFiles } = await import('../src/utils/parser-utils')

      await expect(mockedExtractFiles(Buffer.from('zip'), () => true, extractionLimits)).rejects.toThrow(
        'Could not open read stream'
      )
    })

    it('should handle readStream error', async () => {
      const listeners: Record<string, Function[]> = { entry: [], end: [], error: [] }
      const streamListeners: Record<string, Function[]> = { error: [] }
      const emit = (name: string, payload?: any) => (listeners[name] || []).forEach((fn) => fn(payload))

      const fakeZipfile = {
        readEntry: vi.fn().mockImplementation(() => {
          queueMicrotask(() => emit('entry', { fileName: 'test.txt' }))
        }),
        openReadStream: vi.fn((entry: any, cb: (err: any, stream?: any) => void) => {
          const stream = {
            pipe: vi.fn().mockReturnThis(),
            on: vi.fn((evt: string, handler: Function) => {
              streamListeners[evt] = streamListeners[evt] || []
              streamListeners[evt].push(handler)
              // Immediately trigger error
              if (evt === 'error') {
                queueMicrotask(() => handler(new Error('Stream error')))
              }
            }),
          }
          cb(null, stream)
        }),
        on: vi.fn((evt: string, handler: Function) => {
          listeners[evt] = listeners[evt] || []
          listeners[evt].push(handler)
        }),
        close: vi.fn(),
      } as any

      vi.doMock('yauzl', () => ({
        default: {
          fromBuffer: (_buf: Buffer, _opts: any, cb: (err: any, zf?: any) => void) => cb(null, fakeZipfile),
        },
      }))

      const { extractFiles: mockedExtractFiles } = await import('../src/utils/parser-utils')

      await expect(mockedExtractFiles(Buffer.from('zip'), () => true, extractionLimits)).rejects.toThrow('Stream error')
    })

    it('should handle zipfile error', async () => {
      const listeners: Record<string, Function[]> = { entry: [], end: [], error: [] }
      const emit = (name: string, payload?: any) => (listeners[name] || []).forEach((fn) => fn(payload))

      const fakeZipfile = {
        readEntry: vi.fn().mockImplementation(() => {
          queueMicrotask(() => emit('error', new Error('Zipfile error')))
        }),
        on: vi.fn((evt: string, handler: Function) => {
          listeners[evt] = listeners[evt] || []
          listeners[evt].push(handler)
        }),
        close: vi.fn(),
      } as any

      vi.doMock('yauzl', () => ({
        default: {
          fromBuffer: (_buf: Buffer, _opts: any, cb: (err: any, zf?: any) => void) => cb(null, fakeZipfile),
        },
      }))

      const { extractFiles: mockedExtractFiles } = await import('../src/utils/parser-utils')

      await expect(mockedExtractFiles(Buffer.from('zip'), () => true, extractionLimits)).rejects.toThrow('Zipfile error')
    })
  })
})
