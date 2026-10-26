// @vitest-environment node
import { EventEmitter } from 'node:events'

import type { WebContents } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({
  views: [] as Array<{ webContents: WebContents }>,
  window: {
    contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
    getContentBounds: () => ({ width: 1000, height: 800 }),
  },
}))

vi.mock('electron', () => ({
  shell: { openExternal: vi.fn(async () => {}) },
  BrowserWindow: { fromWebContents: () => native.window },
  session: {
    fromPartition: vi.fn(() => ({
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
      on: vi.fn(),
      clearStorageData: vi.fn(async () => {}),
      clearCache: vi.fn(async () => {}),
    })),
  },
  WebContentsView: class {
    webContents = Object.assign(new EventEmitter(), {
      isDestroyed: () => false,
      getURL: () => 'https://example.com/',
      getTitle: () => 'Page',
      isLoading: () => false,
      navigationHistory: { canGoBack: () => false, canGoForward: () => false },
      loadURL: vi.fn(async () => {}),
      setWindowOpenHandler: vi.fn(),
      close: vi.fn(),
      executeJavaScriptInIsolatedWorld: vi.fn(async () => null),
      capturePage: vi.fn(async () => ({
        isEmpty: () => false,
        getSize: () => ({ width: 800 }),
        toPNG: () => Buffer.from('png'),
      })),
    })
    setVisible = vi.fn()
    setBounds = vi.fn()
    constructor() {
      native.views.push(this as unknown as { webContents: WebContents })
    }
  },
}))

import { BrowserService } from '../BrowserService'

const owner = () => ({ isDestroyed: () => false, getZoomFactor: () => 1 }) as unknown as WebContents

beforeEach(() => {
  native.views.length = 0
  vi.clearAllMocks()
})

describe('BrowserService', () => {
  it('deduplicates per owner/context, enforces ownership, and blocks unsafe URLs', async () => {
    const service = new BrowserService(vi.fn())
    const first = owner()
    const second = owner()
    const state = service.open(first, 'server:user:agent:topic')
    expect(service.open(first, state.contextKey).sessionId).toBe(state.sessionId)
    expect(service.open(second, state.contextKey).sessionId).not.toBe(state.sessionId)
    await expect(service.navigate(first, state.sessionId, 'javascript:alert(1)')).rejects.toThrow('HTTP')
    await expect(service.capture(second, state.sessionId)).rejects.toThrow('已关闭')
    expect(() =>
      service.layout(first, { sessionId: state.sessionId, visible: true, x: NaN, y: 0, width: 100, height: 100 })
    ).toThrow('布局无效')
    await service.reset()
    expect(native.views[0].webContents.close).toHaveBeenCalled()
  })

  it('cancels a pending picker on navigation or reset and rejects late screenshots', async () => {
    const service = new BrowserService(vi.fn())
    const first = owner()
    const state = service.open(first, 'topic')
    const contents = native.views[0].webContents
    vi.mocked(contents.executeJavaScriptInIsolatedWorld).mockImplementation(() => new Promise(() => {}))
    const pending = service.pick(first, state.sessionId)
    contents.emit('did-start-navigation', {}, 'https://example.org', false, true)
    await expect(pending).resolves.toBeNull()
    let finish: (value: never) => void = () => {}
    vi.mocked(contents.capturePage).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const capture = service.capture(first, state.sessionId)
    await Promise.resolve()
    await service.reset()
    finish({} as never)
    await expect(capture).rejects.toThrow('已关闭')
  })

  it('bounds data from the isolated picker before returning it to the composer', async () => {
    const service = new BrowserService(vi.fn())
    const first = owner()
    const state = service.open(first, 'topic')
    vi.mocked(native.views[0].webContents.executeJavaScriptInIsolatedWorld).mockResolvedValue({
      tag: 'p',
      selector: '#a',
      text: 'x'.repeat(9000),
      html: 'x'.repeat(3000),
    })
    const element = await service.pick(first, state.sessionId)
    expect(element?.text.length).toBe(6000)
    expect(element?.html.length).toBe(2000)
    expect(element?.url).toBe('https://example.com/')
    await service.close(first, state.sessionId)
    await expect(service.close(first, state.sessionId)).resolves.toBeUndefined()
  })
})
