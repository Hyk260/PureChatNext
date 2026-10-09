import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { PluginOption } from 'vite'

/**
 * Mirror Next `raw-loader` for `*.html` imports under `src/` (email templates, etc.).
 * Vite's HTML build plugin also transforms ids ending in `.html` and extracts `<style>`.
 * That parse fails on email markup, so these imports resolve to `?raw` and skip it.
 */
export function viteRawHtml(rootDir: string): PluginOption {
  // Normalize so Windows `\` matches Vite ids (`D:/...`).
  const srcDir = `${path.resolve(rootDir, 'src').replaceAll('\\', '/')}/`

  return {
    name: 'vite-raw-html',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!importer || !source.endsWith('.html') || source.includes('?')) return null

      const resolved = await this.resolve(source, importer, { skipSelf: true })
      if (!resolved || resolved.external) return null

      const id = resolved.id.replaceAll('\\', '/')
      if (!id.includes(srcDir)) return null
      return `${id}?raw`
    },
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

export function rawHtmlOptimizerPlugin(rootDir: string): PluginOption {
  const srcDir = path.resolve(rootDir, 'src')

  return {
    name: 'vite-raw-html-optimizer',
    async load(id) {
      const normalizedId = id.replaceAll('\\', '/')
      const [idPath, query = ''] = normalizedId.split('?')
      const filePath = path.resolve(idPath)
      const relativePath = path.relative(srcDir, filePath)

      if (
        !query.split('&').includes('raw') ||
        !filePath.endsWith('.html') ||
        relativePath.startsWith('..') ||
        path.isAbsolute(relativePath)
      ) {
        return null
      }

      const code = await readFile(filePath, 'utf8')
      return `export default ${JSON.stringify(code)}`
    },
  }
}
