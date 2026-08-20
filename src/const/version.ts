import pkg from '@/../package.json'

export const CURRENT_VERSION = pkg.version

const BUILD_TIME_META_RE = /<meta\s+name=["']buildTime["']\s+content=["']([^"']*)["']\s*\/?>/i

/** Parse the SPA HTML shell fingerprint injected at Vite build time. */
export function extractSpaBuildTime(html: string): string | null {
  return html.match(BUILD_TIME_META_RE)?.[1] || null
}
