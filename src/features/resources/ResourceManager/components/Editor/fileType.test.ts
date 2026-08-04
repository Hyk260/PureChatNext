import { describe, expect, it } from 'vitest'

import { getLanguageFromFileName, getPreviewKind } from './fileType'

describe('resource file preview type detection', () => {
  it.each([
    ['application/pdf', 'report.bin', 'pdf'],
    ['application/octet-stream', 'report.PDF', 'pdf'],
    ['image/webp', 'image.bin', 'image'],
    ['application/octet-stream', 'photo.avif', 'image'],
    ['video/mp4', 'clip.bin', 'video'],
    ['application/octet-stream', 'clip.webm', 'video'],
    ['audio/mpeg', 'sound.bin', 'audio'],
    ['application/octet-stream', 'sound.mp3', 'audio'],
    ['text/plain; charset=utf-8', 'notes.bin', 'text'],
    ['application/json', 'data.bin', 'text'],
    ['application/octet-stream', 'README.md', 'text'],
    ['application/octet-stream', 'preview.HTML', 'text'],
    ['application/octet-stream', 'Dockerfile', 'text'],
    ['application/octet-stream', 'config.cjs', 'text'],
    ['application/msword', 'document.doc', 'unsupported'],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'sheet.xlsx', 'unsupported'],
    ['application/zip', 'archive.zip', 'unsupported'],
    ['application/octet-stream', 'binary.bin', 'unsupported'],
  ] as const)('classifies %s / %s as %s', (fileType, name, expected) => {
    expect(getPreviewKind({ fileType, name })).toBe(expected)
  })

  it.each([
    ['index.ts', 'typescript'],
    ['component.jsx', 'jsx'],
    ['README.md', 'markdown'],
    ['page.html', 'html'],
    ['config.yml', 'yaml'],
    ['Dockerfile', 'dockerfile'],
    ['unknown', 'txt'],
  ])('maps %s to the %s highlighter language', (fileName, expected) => {
    expect(getLanguageFromFileName(fileName)).toBe(expected)
  })
})
