import { describe, expect, it } from 'vitest'

import {
  EMPTY_FILE_TABS,
  detectFileIndent,
  fileTabsReducer,
  getPreviewLanguage,
  getProjectFilePath,
  getTextCursor,
} from './previewUtils'

describe('file preview tabs', () => {
  it('keeps multiple files open, reuses existing tabs, and chooses a neighbour when closing the active file', () => {
    let tabs = fileTabsReducer(EMPTY_FILE_TABS, { type: 'open', path: 'src/a.ts' })
    tabs = fileTabsReducer(tabs, { type: 'open', path: 'b.json' })
    tabs = fileTabsReducer(tabs, { type: 'open', path: 'src/a.ts' })
    expect(tabs).toEqual({ activePath: 'src/a.ts', paths: ['src/a.ts', 'b.json'] })
    tabs = fileTabsReducer(tabs, { type: 'close', path: 'src/a.ts' })
    expect(tabs).toEqual({ activePath: 'b.json', paths: ['b.json'] })
    expect(fileTabsReducer(tabs, { type: 'close', path: 'b.json' })).toEqual(EMPTY_FILE_TABS)
  })

  it('does not switch the active file when closing another tab and supports close others/all', () => {
    const tabs = { activePath: 'b.ts', paths: ['a.ts', 'b.ts', 'c.ts'] }
    expect(fileTabsReducer(tabs, { type: 'close', path: 'a.ts' }).activePath).toBe('b.ts')
    expect(fileTabsReducer(tabs, { type: 'closeOthers' })).toEqual({ activePath: 'b.ts', paths: ['b.ts'] })
    expect(fileTabsReducer(tabs, { type: 'closeAll' })).toEqual(EMPTY_FILE_TABS)
  })
})

describe('file preview metadata', () => {
  it('identifies file languages and falls back to plain text', () => {
    expect(getPreviewLanguage('src/INDEX.TS')).toEqual({ label: 'TypeScript', mode: 'typescript' })
    expect(getPreviewLanguage('C:\\project\\component.tsx').mode).toBe('tsx')
    expect(getPreviewLanguage('.env.local').label).toBe('Dotenv')
    expect(getPreviewLanguage('Dockerfile').mode).toBe('dockerfile')
    expect(getPreviewLanguage('unknown.weird').mode).toBe('')
  })

  it('detects two/four spaces and tabs without treating block comments as one-space indentation', () => {
    expect(detectFileIndent('function a() {\n  if (true) {\n    return 1\n  }\n}')).toEqual({ size: 2, useTabs: false })
    expect(detectFileIndent('/**\n * title\n */\nfunction a() {\n    return 1\n}')).toEqual({ size: 4, useTabs: false })
    expect(detectFileIndent('a\n\tb\n\t\tc')).toEqual({ size: 4, useTabs: true })
    expect(detectFileIndent('')).toEqual({ size: 2, useTabs: false })
  })

  it('reports cursor positions at the start, on later lines, and after a final newline', () => {
    expect(getTextCursor('ab\ncd\n', 0)).toEqual({ line: 1, column: 1 })
    expect(getTextCursor('ab\ncd\n', 4)).toEqual({ line: 2, column: 2 })
    expect(getTextCursor('ab\ncd\n', 6)).toEqual({ line: 3, column: 1 })
  })

  it('joins relative paths for POSIX and Windows projects', () => {
    expect(getProjectFilePath('/workspace/', 'src/a.ts')).toBe('/workspace/src/a.ts')
    expect(getProjectFilePath('C:\\workspace\\', 'src/a.ts')).toBe('C:\\workspace\\src\\a.ts')
  })
})
