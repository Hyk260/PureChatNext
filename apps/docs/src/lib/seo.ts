import { PRODUCT_URL, REPOSITORY_URL, SITE_DESCRIPTION, SITE_NAME } from './site'
import { getSiteUrl } from './site-url'
import { source } from './source'

type JsonLdObject = Record<string, unknown>

export type BreadcrumbItem = { name: string; url: string }

const ORGANIZATION_NAME = 'PureChat'

/** 只保留能解析到真实页面的祖先层级，避免面包屑指向 404。 */
export function buildBreadcrumbs(slugs: string[]): BreadcrumbItem[] {
  const siteUrl = getSiteUrl()
  const items: BreadcrumbItem[] = [{ name: '文档首页', url: new URL('/', siteUrl).toString() }]

  for (let depth = 1; depth < slugs.length; depth += 1) {
    const parent = source.getPage(slugs.slice(0, depth))
    if (!parent) continue

    items.push({ name: parent.data.title, url: new URL(parent.url, siteUrl).toString() })
  }

  return items
}

export function organizationJsonLd(): JsonLdObject {
  return {
    '@type': 'Organization',
    name: ORGANIZATION_NAME,
    url: PRODUCT_URL,
  }
}

export function websiteJsonLd(): JsonLdObject {
  return {
    '@type': 'WebSite',
    description: SITE_DESCRIPTION,
    inLanguage: 'zh-CN',
    name: SITE_NAME,
    publisher: organizationJsonLd(),
    url: new URL('/', getSiteUrl()).toString(),
  }
}

export function softwareApplicationJsonLd(): JsonLdObject {
  return {
    '@type': 'SoftwareApplication',
    applicationCategory: 'BusinessApplication',
    codeRepository: REPOSITORY_URL,
    description: SITE_DESCRIPTION,
    isAccessibleForFree: true,
    license: `${REPOSITORY_URL}/blob/main/LICENSE`,
    name: ORGANIZATION_NAME,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'CNY',
    },
    operatingSystem: 'Web',
    publisher: organizationJsonLd(),
    url: PRODUCT_URL,
  }
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdObject {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      item: item.url,
      name: item.name,
      position: index + 1,
    })),
  }
}

export function techArticleJsonLd(params: {
  dateModified?: Date
  description?: string
  title: string
  url: string
}): JsonLdObject {
  const { dateModified, description, title, url } = params

  return {
    '@type': 'TechArticle',
    ...(dateModified ? { dateModified: dateModified.toISOString() } : {}),
    ...(description ? { description } : {}),
    headline: title,
    inLanguage: 'zh-CN',
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: new URL('/', getSiteUrl()).toString() },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    publisher: organizationJsonLd(),
    url,
  }
}

/** 把一组节点打包成单个 JSON-LD 脚本内容。 */
export function jsonLdGraph(...nodes: JsonLdObject[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': nodes,
  })
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
}
