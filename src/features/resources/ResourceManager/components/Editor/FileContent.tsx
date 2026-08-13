'use client'

import { Button, Flexbox, Text } from '@pure/ui'
import { Spin } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { Download } from 'lucide-react'
import { lazy, memo, Suspense, useEffect, useState } from 'react'

import type { FileListItem } from '@/types/files'

import { getPreviewKind } from './fileType'

const SourcePreview = lazy(() => import('./SourcePreview'))

const styles = createStaticStyles(({ css }) => ({
  audio: css`
    width: min(640px, 100%);
  `,
  centered: css`
    width: 100%;
    height: 100%;
    padding: 24px;
  `,
  frame: css`
    width: 100%;
    height: 100%;
    border: none;
    background: ${cssVar.colorBgContainer};
  `,
  image: css`
    display: block;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  `,
  source: css`
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: auto;
    padding: 16px 24px;
    box-sizing: border-box;
  `,
  video: css`
    display: block;
    max-width: 100%;
    max-height: 100%;
  `,
}))

const getFetchCredentials = (url: string): RequestCredentials => {
  try {
    return new URL(url, window.location.href).origin === window.location.origin ? 'include' : 'omit'
  } catch {
    return 'include'
  }
}

const downloadFile = async (url: string, fileName: string) => {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: getFetchCredentials(url),
    })
    if (!response.ok) throw new Error(`Failed to download file: ${response.status}`)

    const blobUrl = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.download = fileName
    link.href = blobUrl
    link.style.display = 'none'
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(blobUrl)
  } catch {
    const link = document.createElement('a')
    link.href = url
    link.rel = 'noopener noreferrer'
    link.target = '_blank'
    link.click()
  }
}

interface PreviewMessageProps {
  description: string
  fileName: string
  url?: string
}

const PreviewMessage = memo<PreviewMessageProps>(({ description, fileName, url }) => {
  const [downloading, setDownloading] = useState(false)

  return (
    <Flexbox align='center' className={styles.centered} gap={12} justify='center'>
      <Text strong>{fileName}</Text>
      <Text type='secondary'>{description}</Text>
      {url && (
        <Button
          icon={<Download size={16} />}
          loading={downloading}
          onClick={async () => {
            setDownloading(true)
            await downloadFile(url, fileName)
            setDownloading(false)
          }}
        >
          下载文件
        </Button>
      )}
    </Flexbox>
  )
})

PreviewMessage.displayName = 'PreviewMessage'

interface TextPreviewProps {
  content?: string | null
  fileName: string
  url?: string
}

interface TextRequestState {
  data?: string
  failed?: boolean
  url?: string
}

const LoadedTextPreview = ({ content, fileName, url }: { content: string; fileName: string; url?: string }) => {
  if (!content) return <PreviewMessage description='文件内容为空' fileName={fileName} url={url} />

  return (
    <div className={styles.source}>
      <Suspense
        fallback={
          <Flexbox align='center' className={styles.centered} justify='center'>
            <Spin />
          </Flexbox>
        }
      >
        <SourcePreview content={content} fileName={fileName} />
      </Suspense>
    </div>
  )
}

const RemoteTextPreview = ({ fileName, url }: { fileName: string; url: string }) => {
  const [requestState, setRequestState] = useState<TextRequestState>({})

  useEffect(() => {
    const controller = new AbortController()

    void fetch(url, {
      credentials: getFetchCredentials(url),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load file: ${response.status}`)
        return response.text()
      })
      .then((data) => setRequestState({ data, url }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setRequestState({ failed: true, url })
      })

    return () => controller.abort()
  }, [url])

  if (requestState.url !== url) {
    return (
      <Flexbox align='center' className={styles.centered} justify='center'>
        <Spin />
      </Flexbox>
    )
  }

  if (requestState.failed) return <PreviewMessage description='文件内容加载失败' fileName={fileName} url={url} />

  return <LoadedTextPreview content={requestState.data ?? ''} fileName={fileName} url={url} />
}

const TextPreview = memo<TextPreviewProps>(({ content, fileName, url }) => {
  if (content !== null && content !== undefined) {
    return <LoadedTextPreview content={content} fileName={fileName} url={url} />
  }

  if (!url) return <PreviewMessage description='文件内容加载失败' fileName={fileName} />

  return <RemoteTextPreview fileName={fileName} url={url} />
})

TextPreview.displayName = 'TextPreview'

interface ImagePreviewProps {
  fileName: string
  onError: () => void
  url: string
}

const ImagePreview = memo<ImagePreviewProps>(({ fileName, onError, url }) => {
  const [loaded, setLoaded] = useState(false)

  return (
    <Flexbox align='center' className={styles.centered} justify='center'>
      {!loaded && <Spin />}
      {/* The preview URL may be authenticated or remote and has no known dimensions. */}
      <img
        alt={fileName}
        className={styles.image}
        src={url}
        style={{ display: loaded ? 'block' : 'none' }}
        onError={onError}
        onLoad={() => setLoaded(true)}
      />
    </Flexbox>
  )
})

ImagePreview.displayName = 'ImagePreview'

interface FileContentProps {
  item: FileListItem
}

const FileContent = memo<FileContentProps>(({ item }) => {
  const [mediaFailed, setMediaFailed] = useState(false)
  const previewKind = getPreviewKind(item)

  if (mediaFailed) return <PreviewMessage description='文件内容加载失败' fileName={item.name} url={item.url} />

  if (previewKind === 'text') {
    return <TextPreview content={item.content} fileName={item.name} url={item.url || undefined} />
  }

  if (!item.url) return <PreviewMessage description='文件内容不可用' fileName={item.name} />

  if (previewKind === 'image') {
    return <ImagePreview key={item.url} fileName={item.name} url={item.url} onError={() => setMediaFailed(true)} />
  }

  if (previewKind === 'pdf') {
    return <iframe className={styles.frame} src={item.url} title={item.name} onError={() => setMediaFailed(true)} />
  }

  if (previewKind === 'video') {
    return (
      <Flexbox align='center' className={styles.centered} justify='center'>
        <video controls className={styles.video} src={item.url} onError={() => setMediaFailed(true)} />
      </Flexbox>
    )
  }

  if (previewKind === 'audio') {
    return (
      <Flexbox align='center' className={styles.centered} justify='center'>
        <audio controls className={styles.audio} src={item.url} onError={() => setMediaFailed(true)} />
      </Flexbox>
    )
  }

  return <PreviewMessage description='暂不支持预览此文件类型' fileName={item.name} url={item.url} />
})

FileContent.displayName = 'FileContent'

export default FileContent
