import { describe, expect, it } from 'vitest'

import { isHtmlPreviewLanguage, toHtmlPreviewSrcDoc } from '../htmlPreview'

describe('isHtmlPreviewLanguage', () => {
  it.each(['html', 'HTML', ' htm ', 'svg'])('accepts %s', (language) => {
    expect(isHtmlPreviewLanguage(language)).toBe(true)
  })

  it.each(['js', 'tsx', 'markdown', '', undefined])('rejects %s', (language) => {
    expect(isHtmlPreviewLanguage(language)).toBe(false)
  })
})

describe('toHtmlPreviewSrcDoc', () => {
  it('keeps a full HTML document intact', () => {
    const html = '<!DOCTYPE html><html><body><h1>Hi</h1></body></html>'
    expect(toHtmlPreviewSrcDoc(html)).toBe(html)
  })

  it('wraps HTML fragments in a document', () => {
    const srcDoc = toHtmlPreviewSrcDoc('<button>登录</button>')
    expect(srcDoc).toContain('<!DOCTYPE html>')
    expect(srcDoc).toContain('<button>登录</button>')
  })

  it('centers SVG fragments for preview', () => {
    const srcDoc = toHtmlPreviewSrcDoc('<svg viewBox="0 0 8 8"></svg>', 'svg')
    expect(srcDoc).toContain('place-items:center')
    expect(srcDoc).toContain('<svg viewBox="0 0 8 8"></svg>')
  })
})
