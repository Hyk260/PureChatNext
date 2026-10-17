import type { SPAServerConfig } from '@/types/spaServerConfig'

import {
  SITE_BAIDU_WEBMASTER_VERIFICATION,
  SITE_BING_WEBMASTER_VERIFICATION,
  SITE_NAME,
  SITE_REPOSITORY_URL,
} from '@/const/site'
import { getPublicSpaRouteMetadata } from '@/const/publicSpaMetadata'

import { serializeForHtml } from './serializeForHtml'

const SERVER_CONFIG_PLACEHOLDER = '<!--SPA_SERVER_CONFIG-->'
const PUBLIC_METADATA_PLACEHOLDER = '<!--SPA_PUBLIC_METADATA-->'

const serverConfigScript = (config: SPAServerConfig) =>
  `<script>window.__SERVER_CONFIG__=${serializeForHtml(config)};</script>`

export type RenderSpaHtmlOptions = {
  publicMetadata?: {
    baseUrl: string
    hasFilters?: boolean
    pathname: string
  }
  serverConfig: SPAServerConfig
  status?: number
}

const escapeHtmlAttribute = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const publicMetadataTags = ({ baseUrl, hasFilters, pathname }: NonNullable<RenderSpaHtmlOptions['publicMetadata']>) => {
  const routeMetadata = getPublicSpaRouteMetadata(pathname, hasFilters)
  const base = new URL(baseUrl)
  const canonicalUrl = new URL(routeMetadata.canonicalPath, base).toString()
  const imageUrl = new URL('/opengraph-image', base).toString()
  const robots = routeMetadata.indexable ? 'index,follow' : 'noindex,follow'
  const structuredData = serializeForHtml({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    applicationCategory: 'BusinessApplication',
    description: routeMetadata.description,
    name: SITE_NAME,
    operatingSystem: 'Web',
    url: new URL('/', base).toString(),
    codeRepository: SITE_REPOSITORY_URL,
  })

  return [
    `<title>${escapeHtmlAttribute(routeMetadata.title)}</title>`,
    `<meta name="description" content="${escapeHtmlAttribute(routeMetadata.description)}" />`,
    `<meta name="baidu-site-verification" content="${SITE_BAIDU_WEBMASTER_VERIFICATION}" />`,
    `<meta name="msvalidate.01" content="${SITE_BING_WEBMASTER_VERIFICATION}" />`,
    `<link rel="canonical" href="${escapeHtmlAttribute(canonicalUrl)}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<meta property="og:type" content="${routeMetadata.openGraphType}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeHtmlAttribute(routeMetadata.title)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttribute(routeMetadata.description)}" />`,
    `<meta property="og:url" content="${escapeHtmlAttribute(canonicalUrl)}" />`,
    `<meta property="og:image" content="${escapeHtmlAttribute(imageUrl)}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtmlAttribute(routeMetadata.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttribute(routeMetadata.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttribute(imageUrl)}" />`,
    ...(routeMetadata.structuredData === 'software-application'
      ? [`<script type="application/ld+json">${structuredData}</script>`]
      : []),
  ].join('\n    ')
}

/** Inject runtime config into the Vite-built HTML template and return a Response. */
export function renderSpaHtml(template: string, options: RenderSpaHtmlOptions): Response {
  const { publicMetadata, serverConfig, status = 200 } = options
  const serverInjection = serverConfigScript(serverConfig)

  let html = template.includes(SERVER_CONFIG_PLACEHOLDER)
    ? template.replace(SERVER_CONFIG_PLACEHOLDER, serverInjection)
    : template.replace('</head>', `  ${serverInjection}\n  </head>`)

  if (publicMetadata) {
    const metadataInjection = publicMetadataTags(publicMetadata)
    html = html
      .replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, '')
      .replace(/<meta\s+name=["']description["'][\s\S]*?\/?\s*>/i, '')
    html = html.includes(PUBLIC_METADATA_PLACEHOLDER)
      ? html.replace(PUBLIC_METADATA_PLACEHOLDER, metadataInjection)
      : html.replace('</head>', `  ${metadataInjection}\n  </head>`)
  }

  return new Response(html, {
    status,
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
