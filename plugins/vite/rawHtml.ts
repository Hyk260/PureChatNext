import path from 'node:path'

import type { PluginOption } from 'vite'

/**
 * Mirror Next `raw-loader` for `*.html` imports under `src/` (email templates, etc.).
 */
export function viteRawHtml(rootDir: string): PluginOption {
  // Normalize so Windows `\` matches Vite ids (`D:/...`).
  const srcDir = `${path.resolve(rootDir, 'src').replaceAll('\\', '/')}/`

  return {
    name: 'vite-raw-html',
    enforce: 'pre',
    transform(code, id) {
      const normalizedId = id.replaceAll('\\', '/')
      if (!normalizedId.endsWith('.html') || !normalizedId.includes(srcDir)) return null

      return {
        code: `export default ${JSON.stringify(code)}`,
        map: null,
      }
    },
  }
}
