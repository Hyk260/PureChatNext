import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FileListItem } from '@/types/files'

const fetchMock = vi.fn()

vi.mock('@pure/ui', () => ({
  Button: ({
    children,
    icon,
    loading,
    onClick,
  }: {
    children?: React.ReactNode
    icon?: React.ReactNode
    loading?: boolean
    onClick?: () => void
  }) => (
    <button aria-busy={loading} type='button' onClick={onClick}>
      {icon}
      {children}
    </button>
  ),
  Flexbox: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('antd', () => ({ Spin: () => <span data-testid='spinner' /> }))

vi.mock('antd-style', () => ({
  createStaticStyles: () => new Proxy({}, { get: (_, key) => String(key) }),
  cssVar: new Proxy({}, { get: (_, key) => String(key) }),
}))

vi.mock('./SourcePreview', () => ({
  default: ({ content, fileName }: { content: string; fileName: string }) => (
    <pre data-file-name={fileName} data-testid='source-preview'>
      {content}
    </pre>
  ),
}))

import FileContent from './FileContent'

const createItem = (overrides: Partial<FileListItem>): FileListItem => ({
  chunkCount: null,
  chunkingError: null,
  chunkingStatus: null,
  content: null,
  createdAt: new Date('2026-01-01'),
  editorData: null,
  embeddingError: null,
  embeddingStatus: null,
  fileType: 'application/octet-stream',
  finishEmbedding: false,
  id: 'file-1',
  metadata: null,
  name: 'file.bin',
  size: 10,
  sourceType: 'file',
  updatedAt: new Date('2026-01-01'),
  url: '/api/resources/files/file-1/content',
  ...overrides,
})

describe('FileContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('renders browser-native image, PDF, video, and audio previews', () => {
    const { container, rerender } = render(
      <FileContent item={createItem({ fileType: 'image/png', name: 'image.png' })} />
    )
    const image = container.querySelector('img')
    expect(image).toBeTruthy()
    expect(screen.getByTestId('spinner')).toBeTruthy()
    fireEvent.load(image!)
    expect(screen.queryByTestId('spinner')).toBeNull()
    expect(screen.getByRole('img', { name: 'image.png' })).toBeTruthy()

    rerender(<FileContent item={createItem({ fileType: 'application/pdf', name: 'report.pdf' })} />)
    expect(screen.getByTitle('report.pdf')).toBeTruthy()

    rerender(<FileContent item={createItem({ fileType: 'video/mp4', name: 'clip.mp4' })} />)
    expect(container.querySelector('video[controls]')).toBeTruthy()

    rerender(<FileContent item={createItem({ fileType: 'audio/mpeg', name: 'sound.mp3' })} />)
    expect(container.querySelector('audio[controls]')).toBeTruthy()
  })

  it.each([
    ['README.md', 'text/markdown', '# Heading'],
    ['preview.html', 'text/html', '<script>alert("no")</script>'],
  ])('shows %s as source without executing it', async (name, fileType, content) => {
    const { container } = render(<FileContent item={createItem({ content, fileType, name })} />)

    const source = await screen.findByTestId('source-preview')
    expect(source.textContent).toBe(content)
    expect(container.querySelector('script')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loads text through the authenticated content URL', async () => {
    fetchMock.mockResolvedValue(new Response('const value = 1', { status: 200 }))

    render(<FileContent item={createItem({ fileType: 'text/typescript', name: 'index.ts' })} />)

    expect(screen.getByTestId('spinner')).toBeTruthy()
    expect((await screen.findByTestId('source-preview')).textContent).toBe('const value = 1')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/resources/files/file-1/content',
      expect.objectContaining({ credentials: 'include', signal: expect.any(AbortSignal) })
    )
  })

  it('cancels a stale text request when the file changes', async () => {
    let firstSignal: AbortSignal | undefined
    fetchMock
      .mockImplementationOnce((_url: string, init: RequestInit) => {
        firstSignal = init.signal as AbortSignal
        return new Promise<Response>(() => {})
      })
      .mockResolvedValueOnce(new Response('new content', { status: 200 }))

    const { rerender } = render(
      <FileContent item={createItem({ fileType: 'text/plain', id: 'old', name: 'old.txt', url: '/api/old' })} />
    )
    rerender(<FileContent item={createItem({ fileType: 'text/plain', id: 'new', name: 'new.txt', url: '/api/new' })} />)

    await waitFor(() => expect(firstSignal?.aborted).toBe(true))
    expect((await screen.findByTestId('source-preview')).textContent).toBe('new content')
  })

  it('shows a download action for unsupported files', async () => {
    const createObjectURL = vi.fn(() => 'blob:download')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fetchMock.mockResolvedValue(new Response('office data', { status: 200 }))

    render(<FileContent item={createItem({ fileType: 'application/msword', name: 'document.doc' })} />)

    expect(screen.getByText('暂不支持预览此文件类型')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /下载文件/ }))

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce())
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:download')
  })

  it('shows an error and download action when text loading fails', async () => {
    fetchMock.mockRejectedValue(new Error('network error'))

    render(<FileContent item={createItem({ fileType: 'text/plain', name: 'notes.txt' })} />)

    expect(await screen.findByText('文件内容加载失败')).toBeTruthy()
    expect(screen.getByRole('button', { name: /下载文件/ })).toBeTruthy()
  })
})
