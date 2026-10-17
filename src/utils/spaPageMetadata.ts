import { SITE_DEFAULT_URL, SITE_NAME } from '@/const/site'
import { getPublicSpaRouteMetadata } from '@/const/publicSpaMetadata'

type MetaAttribute = 'name' | 'property'

const setMetaContent = (head: HTMLHeadElement, attribute: MetaAttribute, key: string, content: string) => {
  let meta = head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)

  if (!meta) {
    meta = head.ownerDocument.createElement('meta')
    meta.setAttribute(attribute, key)
    head.append(meta)
  }

  meta.content = content
}

export function syncSpaPageMetadata(document: Document, pathname: string, hasFilters = false) {
  const metadata = getPublicSpaRouteMetadata(pathname, hasFilters)
  const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  const siteUrl = new URL(canonical?.href ?? SITE_DEFAULT_URL)
  const canonicalUrl = new URL(metadata.canonicalPath, `${siteUrl.origin}/`).toString()
  const imageUrl = new URL('/opengraph-image', siteUrl.origin).toString()
  const robots = metadata.indexable ? 'index,follow' : 'noindex,follow'

  document.title = metadata.title

  if (canonical) canonical.href = canonicalUrl

  setMetaContent(document.head, 'name', 'description', metadata.description)
  setMetaContent(document.head, 'name', 'robots', robots)
  setMetaContent(document.head, 'property', 'og:type', metadata.openGraphType)
  setMetaContent(document.head, 'property', 'og:site_name', SITE_NAME)
  setMetaContent(document.head, 'property', 'og:title', metadata.title)
  setMetaContent(document.head, 'property', 'og:description', metadata.description)
  setMetaContent(document.head, 'property', 'og:url', canonicalUrl)
  setMetaContent(document.head, 'property', 'og:image', imageUrl)
  setMetaContent(document.head, 'name', 'twitter:card', 'summary_large_image')
  setMetaContent(document.head, 'name', 'twitter:title', metadata.title)
  setMetaContent(document.head, 'name', 'twitter:description', metadata.description)
  setMetaContent(document.head, 'name', 'twitter:image', imageUrl)
}
