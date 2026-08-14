'use client'

import { ActionIcon } from '@pure/ui'
import type { MarkdownProps } from '@pure/ui/Markdown'
import { Markdown } from '@pure/ui/Markdown'
import { createStaticStyles, cx } from 'antd-style'
import { Eye } from 'lucide-react'
import { memo, useMemo, useState } from 'react'

import HtmlPreviewModal from '@/features/chat/HtmlPreviewModal'
import { isHtmlPreviewLanguage } from '@/features/chat/htmlPreview'

const styles = createStaticStyles(({ css }) => ({
  colorfulFileIcons: css`
    .ant-highlighter .languageTitle {
      opacity: 1;
      filter: grayscale(0%);
    }
  `,
}))

const STATIC_HIGHLIGHT_PROPS = {
  animated: false,
  fullFeatured: true,
} as const

const MARKDOWN_PROPS = {
  enableImageGallery: false,
  enableMermaid: true,
  enableStream: true,
  fullFeaturedCodeBlock: true,
  enableCustomFootnotes: true,
  showFootnotes: true,
  variant: 'chat',
} satisfies Partial<MarkdownProps>

interface MessageMarkdownProps {
  className?: string
  isStreaming?: boolean
  text: string
}

const MessageMarkdown = memo<MessageMarkdownProps>(({ text, className, isStreaming = false }) => {
  const [preview, setPreview] = useState<{ content: string; language: string } | null>(null)

  const componentProps = useMemo<MarkdownProps['componentProps']>(
    () => ({
      highlight: {
        ...STATIC_HIGHLIGHT_PROPS,
        actionsRender: ({ actionIconSize, getContent, language, originalNode }) => {
          if (isStreaming || !isHtmlPreviewLanguage(language)) return originalNode

          return (
            <>
              <ActionIcon
                icon={Eye}
                size={actionIconSize}
                title='预览'
                onClick={() => setPreview({ content: getContent(), language })}
              />
              {originalNode}
            </>
          )
        },
      },
      img: { preview: false },
    }),
    [isStreaming]
  )

  return (
    <>
      <Markdown
        {...MARKDOWN_PROPS}
        animated={isStreaming}
        className={cx(styles.colorfulFileIcons, className)}
        componentProps={componentProps}
      >
        {text}
      </Markdown>
      {preview ? (
        <HtmlPreviewModal
          content={preview.content}
          language={preview.language}
          open
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  )
})

MessageMarkdown.displayName = 'MessageMarkdown'

export default MessageMarkdown
