import { ArrowUp, PencilLine } from 'lucide-react'

export function TocFooter({ editUrl }: { editUrl: string }) {
  return (
    <div className='mt-6 grid gap-1 border-t pt-5 text-sm'>
      <a className='docs-rail-action' href={editUrl} rel='noreferrer' target='_blank'>
        <PencilLine aria-hidden className='size-4' />
        在 GitHub 编辑此页
      </a>
      <a className='docs-rail-action' href='#top'>
        <ArrowUp aria-hidden className='size-4' />
        返回顶部
      </a>
    </div>
  )
}
