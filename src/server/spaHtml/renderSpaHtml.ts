import type { SPAServerConfig } from '@/types/spaServerConfig'

import { serializeForHtml } from './serializeForHtml'

const SERVER_CONFIG_PLACEHOLDER = '<!--SPA_SERVER_CONFIG-->'

const serverConfigScript = (config: SPAServerConfig) =>
  `<script>window.__SERVER_CONFIG__=${serializeForHtml(config)};</script>`

export type RenderSpaHtmlOptions = {
  serverConfig: SPAServerConfig
}

/** Inject runtime config into the Vite-built HTML template and return a Response. */
export function renderSpaHtml(template: string, options: RenderSpaHtmlOptions): Response {
  const { serverConfig } = options
  const injection = serverConfigScript(serverConfig)

  const html = template.includes(SERVER_CONFIG_PLACEHOLDER)
    ? template.replace(SERVER_CONFIG_PLACEHOLDER, injection)
    : template.replace('</head>', `  ${injection}\n  </head>`)

  return new Response(html, {
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
