import type { Plugin } from 'vite'

const BUILD_TIME_META_RE = /<meta\s+name=["']buildTime["']/i

export function createHtmlBuildTimePlugin(buildTime = new Date().toISOString()): Plugin {
  const metaTag = `<meta name="buildTime" content="${buildTime}" />`

  return {
    name: 'html-build-time',
    apply: 'build',
    transformIndexHtml(html) {
      if (BUILD_TIME_META_RE.test(html)) return html
      if (!html.includes('<head>')) return html
      return html.replace('<head>', `<head>\n    ${metaTag}`)
    },
  }
}

/** Build-time fingerprint; ISO is computed when Vite config loads so one build shares one value. */
export const htmlBuildTimePlugin = createHtmlBuildTimePlugin()
