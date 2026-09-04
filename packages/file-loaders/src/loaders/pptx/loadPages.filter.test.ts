// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/parser-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/parser-utils')>()

  return {
    ...actual,
    extractFiles: vi.fn(async (_filePath: string, filter: (fileName: string) => boolean) => {
      const entries = ['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml']
      return entries.filter(filter).map((path) => ({
        content:
          '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
          `<p:cSld><p:spTree><p:sp><p:txBody><a:p><a:t>${path}</a:t></a:p></p:txBody></p:sp></p:spTree></p:cSld>` +
          '</p:sld>',
        path,
      }))
    }),
  }
})

import { PptxLoader } from './index'

describe('PptxLoader slide filtering', () => {
  it('extracts consecutive slide XML entries without skipping', async () => {
    const pages = await new PptxLoader().loadPages('slides.pptx')

    expect(pages.map((page) => page.metadata.slideNumber)).toEqual([1, 2])
  })
})
