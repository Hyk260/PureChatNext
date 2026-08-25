import type { Metadata } from 'next'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import { DocsBody, DocsPage } from 'fumadocs-ui/layouts/docs/page'
import { notFound } from 'next/navigation'
import { getMDXComponents } from '@/components/mdx'
import { HomeCards } from '@/components/home-cards'
import { TocFooter } from '@/components/toc-footer'
import { SITE_NAME, SITE_URL } from '@/lib/site'
import { getGitHubEditUrl, source } from '@/lib/source'

export const dynamicParams = false

export default async function Page({ params }: PageProps<'/[[...slug]]'>) {
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) notFound()

  const MDX = page.data.body
  const editUrl = getGitHubEditUrl(page.path)

  return (
    <DocsPage
      breadcrumb={{ includeRoot: true }}
      tableOfContent={{
        footer: <TocFooter editUrl={editUrl} />,
        header: <p className='mb-4 text-sm font-semibold'>本页内容</p>,
      }}
      toc={page.data.toc}
    >
      <DocsBody className='docs-body'>
        {page.url === '/' ? <HomeCards /> : null}
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
      </DocsBody>
    </DocsPage>
  )
}

export function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata({ params }: PageProps<'/[[...slug]]'>): Promise<Metadata> {
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) notFound()

  const canonical = new URL(page.url, SITE_URL).toString()

  return {
    alternates: { canonical },
    description: page.data.description,
    openGraph: {
      description: page.data.description,
      siteName: SITE_NAME,
      title: page.data.title,
      type: 'article',
      url: canonical,
    },
    title: page.data.title,
    twitter: {
      card: 'summary_large_image',
      description: page.data.description,
      title: page.data.title,
    },
  }
}
