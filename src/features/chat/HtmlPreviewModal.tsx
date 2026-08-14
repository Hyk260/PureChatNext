'use client'

import { Modal } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'

import { toHtmlPreviewSrcDoc } from '@/features/chat/htmlPreview'

const HTML_PREVIEW_SANDBOX = 'allow-scripts allow-forms allow-modals'

const styles = createStaticStyles(({ css }) => ({
  frame: css`
    display: block;
    width: 100%;
    height: 100%;
    border: none;
    background: ${cssVar.colorBgLayout};
  `,
}))

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
      <iframe
        className={styles.frame}
        referrerPolicy='no-referrer'
        sandbox={HTML_PREVIEW_SANDBOX}
        srcDoc={toHtmlPreviewSrcDoc(content, language)}
        title='HTML 预览'
      />
    </Modal>
  )
})

HtmlPreviewModal.displayName = 'HtmlPreviewModal'

export default HtmlPreviewModal
