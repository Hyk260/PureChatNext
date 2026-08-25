import type { Metadata } from 'next'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import { notFound } from 'next/navigation'
import { getMDXComponents } from '@/components/mdx'
import { HomeCards } from '@/components/home-cards'
import { PageActions } from '@/components/page-actions'
import { TocFooter } from '@/components/toc-footer'
import { getMarkdownUrl } from '@/lib/markdown'
import { SITE_NAME, SITE_URL } from '@/lib/site'
import { getGitHubEditUrl, getGitHubSourceUrl, source } from '@/lib/source'

export const dynamicParams = false

export default async function Page({ params }: PageProps<'/[[...slug]]'>) {
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) notFound()

  const MDX = page.data.body
  const editUrl = getGitHubEditUrl(page.path)
  const githubUrl = getGitHubSourceUrl(page.path)
  const markdownUrl = getMarkdownUrl(page.url)

  return (
    <DocsPage
      breadcrumb={{ includeRoot: true }}
      tableOfContent={{
        footer: <TocFooter editUrl={editUrl} />,
      }}
      toc={page.data.toc.filter((item) => item.depth > 1)}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <PageActions githubUrl={githubUrl} markdownUrl={markdownUrl} />
      <DocsBody className='docs-body'>
        {page.url === '/' ? <HomeCards /> : null}
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page), h1: () => null })} />
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
