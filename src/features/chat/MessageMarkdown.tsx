'use client'

import { Markdown } from '@pure/ui/Markdown'
import type { MarkdownProps } from '@pure/ui/Markdown'
import { useDeferredValue, useMemo } from 'react'

/**
 * Streaming strategy:
 * - While generating, render plain text (live `text`) so tokens paint immediately.
 *   Enabling Markdown Streamdown (`enableStream` + `animated`) under high-frequency
 *   parent updates nests setStates → "Maximum update depth exceeded".
 * - When idle, render full Markdown with Streamdown off and deferred content.
 */
const STATIC_COMPONENT_PROPS = {
  // Keep shiki-stream off — animated highlight also loops under parent updates
  highlight: { animated: false, fullFeatured: true },
  // Avoid Image preview's deprecated antd `rootClassName`
  img: { preview: false },
} as const

interface MessageMarkdownProps {
  className?: string
  isStreaming?: boolean
  text: string
}

const MessageMarkdown = ({ text, className, isStreaming = false }: MessageMarkdownProps) => {
  const deferredText = useDeferredValue(text)

  const markdownProps = useMemo(
    (): Partial<MarkdownProps> => ({
      animated: false,
      componentProps: STATIC_COMPONENT_PROPS,
      enableImageGallery: false,
      enableMermaid: true,
      enableStream: false,
      fullFeaturedCodeBlock: true,
      variant: 'chat',
    }),
    []
  )

  // Live text during stream — Markdown/Streamdown is too heavy and can loop.
  if (isStreaming) {
    return (
      <div className={className} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {text}
      </div>
    )
  }

  return (
    <Markdown className={className} {...markdownProps}>
      {deferredText}
    </Markdown>
  )
}

MessageMarkdown.displayName = 'MessageMarkdown'

export default MessageMarkdown
