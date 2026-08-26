import { describe, expect, it } from 'vitest'

import { APP_RENDERER_URL, assertTrustedIpcSender, isSafeExternalUrl, isTrustedRendererUrl } from './rendererSecurity'

describe('renderer URL trust', () => {
  it.each(['/auth/signin', '/chat?topic=1#last'])('allows packaged routes: %s', (route) => {
    expect(isTrustedRendererUrl(`purechat://renderer${route}`, APP_RENDERER_URL)).toBe(true)
  })

  it.each([
    'purechat://renderer-evil/api', 'purechat://renderer.evil/api', 'purechat://renderer:123/api',
    'purechat://user@renderer/api', 'purechat://renderer@evil/api', 'file:///tmp/index.html',
    'http://127.0.0.1:5176/', 'https://example.com/', 'not a URL',
  ])('rejects a non-packaged origin: %s', (value) => {
    expect(isTrustedRendererUrl(value, APP_RENDERER_URL)).toBe(false)
  })

  it('only trusts the configured loopback origin in development', () => {
    const expected = 'http://127.0.0.1:5176/'
    expect(isTrustedRendererUrl(`${expected}auth/signin`, expected)).toBe(true)
    for (const value of ['http://127.0.0.1:5174/', 'http://localhost:5176/', 'http://user@127.0.0.1:5176/', APP_RENDERER_URL]) {
      expect(isTrustedRendererUrl(value, expected)).toBe(false)
    }
    expect(isTrustedRendererUrl('https://example.com/', 'https://example.com/')).toBe(false)
  })
})

describe('IPC sender trust', () => {
  const createContents = () => ({ mainFrame: { url: APP_RENDERER_URL }, isDestroyed: () => false })

  it('allows the current window main frame', () => {
    const sender = createContents()
    expect(() => assertTrustedIpcSender({ sender, senderFrame: sender.mainFrame }, sender, APP_RENDERER_URL)).not.toThrow()
  })

  it('rejects a different window, subframe, missing frame, or destroyed window', () => {
    const trusted = createContents()
    const other = createContents()
    for (const event of [
      { sender: other, senderFrame: other.mainFrame },
      { sender: trusted, senderFrame: { url: APP_RENDERER_URL } },
      { sender: trusted, senderFrame: null },
    ]) expect(() => assertTrustedIpcSender(event, trusted, APP_RENDERER_URL)).toThrow('未授权')

    const event = { sender: trusted, senderFrame: trusted.mainFrame }
    expect(() => assertTrustedIpcSender(event, null, APP_RENDERER_URL)).toThrow('未授权')
    trusted.isDestroyed = () => true
    expect(() => assertTrustedIpcSender(event, trusted, APP_RENDERER_URL)).toThrow('未授权')
  })

  it('rechecks the actual frame URL after navigation', () => {
    const sender = createContents()
    sender.mainFrame.url = 'purechat://renderer-evil/'
    expect(() => assertTrustedIpcSender({ sender, senderFrame: sender.mainFrame }, sender, APP_RENDERER_URL)).toThrow('未授权')
  })
})

describe('external links', () => {
  it('allows HTTPS and local HTTP without URL credentials', () => {
    expect(isSafeExternalUrl('https://example.com/path')).toBe(true)
    expect(isSafeExternalUrl('http://localhost:3000/')).toBe(true)
    for (const value of ['file:///tmp/a', 'javascript:alert(1)', 'http://example.com', 'https://user:secret@example.com', 'invalid']) {
      expect(isSafeExternalUrl(value)).toBe(false)
    }
  })
})
