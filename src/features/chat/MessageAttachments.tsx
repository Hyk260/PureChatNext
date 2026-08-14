'use client'

import { Flexbox } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import type { UIMessage } from 'ai'
import { FileText } from 'lucide-react'
import { memo } from 'react'

const styles = createStaticStyles(({ css }) => ({
  attachment: css`
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 280px;
    margin-block-end: 8px;
    padding: 7px 9px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 10px;
    background: ${cssVar.colorBgContainer};
  `,
  attachmentImage: css`
    display: block;
    width: 180px;
    max-height: 180px;
    object-fit: contain;
    border-radius: 8px;
  `,
  attachmentName: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}))

const MessageAttachments = memo<{ message: UIMessage }>(({ message }) => {
  const files = message.parts.filter((part) => part.type === 'file') as Array<{
    type: 'file'
    mediaType?: string
    url: string
    filename?: string
    name?: string
  }>

  if (files.length === 0) return null

  return (
    <Flexbox gap={8} style={{ marginBlockEnd: 4 }}>
      {files.map((file, index) => {
        const name = file.filename ?? file.name ?? '附件'
        if (file.mediaType?.startsWith('image/')) {
          return (
            <a key={`${name}-${index}`} href={file.url} rel='noreferrer' target='_blank'>
              <img alt={name} className={styles.attachmentImage} src={file.url} />
            </a>
          )
        }

        return (
          <div className={styles.attachment} key={`${name}-${index}`} title={name}>
            <FileText size={18} />
            <span className={styles.attachmentName}>{name}</span>
          </div>
        )
      })}
    </Flexbox>
  )
})

MessageAttachments.displayName = 'MessageAttachments'

export default MessageAttachments
