'use client'

import type { HtmlPreviewProps } from '@pure/ui'
import { ActionIcon, copyToClipboard, HtmlPreview, Modal } from '@pure/ui'
import { Segmented } from 'antd'
import { Copy, Download } from 'lucide-react'
import { memo } from 'react'

import { toHtmlPreviewSrcDoc } from '@/features/chat/htmlPreview'

const MODE_OPTIONS = [
  { label: '预览', value: 'preview' },
  { label: '源码', value: 'source' },
] as const

async function downloadHtml(content: string, fileName = 'preview.html') {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.download = fileName
    link.href = url
    link.style.display = 'none'
    document.body.append(link)
    link.click()
    link.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

const actionsRender: NonNullable<HtmlPreviewProps['actionsRender']> = ({
  actionIconSize,
  getContent,
  mode,
  setMode,
}) => (
  <>
    <Segmented
      options={[...MODE_OPTIONS]}
      size='small'
      value={mode}
      onChange={(value) => setMode(value as typeof mode)}
    />
    <ActionIcon
      icon={Copy}
      size={actionIconSize}
      title='复制'
      onClick={() => {
        void copyToClipboard(getContent())
      }}
    />
    <ActionIcon
      icon={Download}
      size={actionIconSize}
      title='下载 HTML'
      onClick={() => {
        void downloadHtml(getContent())
      }}
    />
  </>
)

interface HtmlPreviewModalProps {
  content: string
  language?: string
  onClose: () => void
  open: boolean
}

const HtmlPreviewModal = memo<HtmlPreviewModalProps>(({ content, language = 'html', onClose, open }) => {
  return (
    <Modal
      destroyOnHidden
      footer={null}
      open={open}
      styles={{ body: { height: 'min(72vh, 720px)', overflow: 'hidden', padding: 0 } }}
      title='预览'
      width='min(96vw, 1080px)'
      onCancel={onClose}
    >
      <HtmlPreview
        language={language}
        copyable={true}
        defaultHeight={360}
        downloadable={true}
        style={{ height: '100%' }}
        styles={{ iframe: { height: '100%' } }}
        variant='borderless'
        actionsRender={actionsRender}
      >
        {toHtmlPreviewSrcDoc(content, language)}
      </HtmlPreview>
    </Modal>
  )
})

HtmlPreviewModal.displayName = 'HtmlPreviewModal'

export default HtmlPreviewModal
