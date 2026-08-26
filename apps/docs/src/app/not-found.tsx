import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className='mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center px-6 text-center'>
      <span className='text-sm font-semibold text-fd-primary'>404</span>
      <h1 className='mt-3 text-3xl font-semibold tracking-tight'>页面不存在</h1>
      <p className='mt-4 text-fd-muted-foreground'>你访问的文档可能已移动、更名或暂时不可用。</p>
      <Link className='mt-8 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium' href='/'>
        <ArrowLeft aria-hidden className='size-4' />
        返回文档首页
      </Link>
    </main>
  )
}
