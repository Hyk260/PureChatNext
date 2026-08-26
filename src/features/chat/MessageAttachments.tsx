'use client'

import { Flexbox } from '@pure/ui'
import { Image } from 'antd'
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
    width: 60px;
    max-height: 60px;
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

  const imageFiles = files.filter((file) => file.mediaType?.startsWith('image/'))
  const otherFiles = files.filter((file) => !file.mediaType?.startsWith('image/'))

  return (
    <Flexbox gap={8} style={{ marginBlockEnd: 4 }}>
      {imageFiles.length > 0 ? (
        <Image.PreviewGroup>
          {imageFiles.map((file, index) => {
            const name = file.filename ?? file.name ?? '附件'
            return (
              <Image
                key={`${name}-${index}`}
                alt={name}
                classNames={{ image: styles.attachmentImage }}
                src={file.url}
              />
            )
          })}
        </Image.PreviewGroup>
      ) : null}
      {otherFiles.map((file, index) => {
        const name = file.filename ?? file.name ?? '附件'
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
