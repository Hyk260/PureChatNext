import { afterEach, describe, expect, it, vi } from 'vitest'

import { downloadBlob } from './downloadBlob'

afterEach(() => vi.restoreAllMocks())

describe('downloadBlob', () => {
  it('downloads the supplied blob and releases DOM and object URL resources', () => {
    const blob = new Blob(['content'], { type: 'application/json' })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-download')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('result.json')
      expect(this.href).toBe('blob:test-download')
      expect(document.body.contains(this)).toBe(true)
    })

    downloadBlob(blob, 'result.json')

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(click).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:test-download')
    expect(document.querySelector('[download="result.json"]')).toBeNull()
  })

  it('cleans up and propagates a failed click', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-failed')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('click failed')
    })

    expect(() => downloadBlob(new Blob(['content']), 'failed.json')).toThrow('click failed')
    expect(revoke).toHaveBeenCalledWith('blob:test-failed')
    expect(document.querySelector('[download="failed.json"]')).toBeNull()
  })
})
