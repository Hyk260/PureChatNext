import { notFound } from 'next/navigation'
import { getMarkdownText, resolveMarkdownSlug } from '@/lib/markdown'
import { source } from '@/lib/source'

export const revalidate = false

export async function GET(_request: Request, { params }: RouteContext<'/raw-content/[[...slug]]'>) {
  const { slug } = await params
  const page = source.getPage(resolveMarkdownSlug(slug))
  if (!page) notFound()

  return new Response(await getMarkdownText(page), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export function generateStaticParams() {
  return [{ slug: [] }, ...source.generateParams()]
}
