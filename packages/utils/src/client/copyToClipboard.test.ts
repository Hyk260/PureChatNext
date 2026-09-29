import { afterEach, describe, expect, it, vi } from 'vitest'

import { copyToClipboard } from './copyToClipboard'

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses navigator.clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await copyToClipboard('hello')

    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to textarea when clipboard fails', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    const execCommand = vi.fn().mockReturnValue(true)
    vi.stubGlobal('document', {
      ...document,
      execCommand,
      createElement: document.createElement.bind(document),
      body: document.body,
    })

    await copyToClipboard('fallback')

    expect(execCommand).toHaveBeenCalledWith('copy')
  })
})
