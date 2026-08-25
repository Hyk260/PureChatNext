import { Code2, ExternalLink } from 'lucide-react'
import { MarkdownCopyButton } from 'fumadocs-ui/layouts/docs/page'

export function PageActions({
  githubUrl,
  markdownUrl,
}: {
  githubUrl: string
  markdownUrl: string
}) {
  return (
    <div className='docs-page-actions'>
      <MarkdownCopyButton markdownUrl={markdownUrl}>Copy Markdown</MarkdownCopyButton>
      <details className='docs-open-menu'>
        <summary>打开</summary>
        <div className='docs-open-menu-content'>
          <a href={markdownUrl} rel='noreferrer' target='_blank'>
            <ExternalLink aria-hidden className='size-4' />
            查看 Markdown
          </a>
          <a href={githubUrl} rel='noreferrer' target='_blank'>
            <Code2 aria-hidden className='size-4' />
            在 GitHub 查看源文件
          </a>
        </div>
      </details>
    </div>
  )
}
