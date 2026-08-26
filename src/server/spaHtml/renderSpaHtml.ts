import type { SPAServerConfig } from '@/types/spaServerConfig'

import { isPublicSpaPath, SITE_DESCRIPTION, SITE_NAME, SITE_REPOSITORY_URL, SITE_TITLE } from '@/const/site'

import { serializeForHtml } from './serializeForHtml'

const SERVER_CONFIG_PLACEHOLDER = '<!--SPA_SERVER_CONFIG-->'
const PUBLIC_METADATA_PLACEHOLDER = '<!--SPA_PUBLIC_METADATA-->'

const serverConfigScript = (config: SPAServerConfig) =>
  `<script>window.__SERVER_CONFIG__=${serializeForHtml(config)};</script>`

export type RenderSpaHtmlOptions = {
  publicMetadata?: {
    baseUrl: string
    pathname: string
  }
  serverConfig: SPAServerConfig
}

const escapeHtmlAttribute = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const publicMetadataTags = ({ baseUrl, pathname }: NonNullable<RenderSpaHtmlOptions['publicMetadata']>) => {
  const base = new URL(baseUrl)
  const canonicalUrl = new URL(pathname, base).toString()
  const imageUrl = new URL('/opengraph-image', base).toString()
  const robots = isPublicSpaPath(pathname) ? 'index,follow' : 'noindex,nofollow'
  const structuredData = serializeForHtml({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    applicationCategory: 'BusinessApplication',
    description: SITE_DESCRIPTION,
    name: SITE_NAME,
    operatingSystem: 'Web',
    url: new URL('/', base).toString(),
    codeRepository: SITE_REPOSITORY_URL,
  })

  return [
    `<link rel="canonical" href="${escapeHtmlAttribute(canonicalUrl)}" />`,
    `<meta name="robots" content="${robots}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeHtmlAttribute(SITE_TITLE)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttribute(SITE_DESCRIPTION)}" />`,
    `<meta property="og:url" content="${escapeHtmlAttribute(canonicalUrl)}" />`,
    `<meta property="og:image" content="${escapeHtmlAttribute(imageUrl)}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtmlAttribute(SITE_TITLE)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttribute(SITE_DESCRIPTION)}" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttribute(imageUrl)}" />`,
    `<script type="application/ld+json">${structuredData}</script>`,
  ].join('\n    ')
}

/** Inject runtime config into the Vite-built HTML template and return a Response. */
export function renderSpaHtml(template: string, options: RenderSpaHtmlOptions): Response {
  const { publicMetadata, serverConfig } = options
  const serverInjection = serverConfigScript(serverConfig)

  let html = template.includes(SERVER_CONFIG_PLACEHOLDER)
    ? template.replace(SERVER_CONFIG_PLACEHOLDER, serverInjection)
    : template.replace('</head>', `  ${serverInjection}\n  </head>`)

  if (publicMetadata) {
    const metadataInjection = publicMetadataTags(publicMetadata)
    html = html.includes(PUBLIC_METADATA_PLACEHOLDER)
      ? html.replace(PUBLIC_METADATA_PLACEHOLDER, metadataInjection)
      : html.replace('</head>', `  ${metadataInjection}\n  </head>`)
  }

  return new Response(html, {
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
