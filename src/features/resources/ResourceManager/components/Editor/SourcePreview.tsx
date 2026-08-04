'use client'

import { Highlighter } from '@pure/ui/Markdown'
import { memo } from 'react'

import { getLanguageFromFileName } from './fileType'

interface SourcePreviewProps {
  content: string
  fileName: string
}

const SourcePreview = memo<SourcePreviewProps>(({ content, fileName }) => (
  <Highlighter language={getLanguageFromFileName(fileName)} showLanguage={false} variant='borderless'>
    {content}
  </Highlighter>
))

SourcePreview.displayName = 'SourcePreview'

export default SourcePreview
