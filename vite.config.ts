import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import type { PluginOption } from 'vite'
import { defineConfig, loadEnv } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const spaEntry = path.resolve(rootDir, 'src/spa/entry.web.tsx')

const isNodePackage = (id: string, packageName: string) => {
  const normalized = id.replaceAll('\\', '/')
  return normalized.includes(`/node_modules/${packageName}/`)
}

/** Group leaf vendor modules to reduce chunk count (aligned with lobe-chat sharedManualChunks). */
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return

  if (
    isNodePackage(id, 'react') ||
    isNodePackage(id, 'react-dom') ||
    isNodePackage(id, 'react-router') ||
    isNodePackage(id, 'scheduler')
  ) {
    return 'vendor-react'
  }

  if (
    id.includes('es-toolkit') ||
    id.includes('@emotion/') ||
    id.includes('/motion/') ||
    id.includes('framer-motion')
  ) {
    return 'vendor-ui-runtime'
  }

  if (isNodePackage(id, 'swr') || isNodePackage(id, 'zustand')) {
    return 'vendor-data-runtime'
  }

  if (id.includes('lucide-react')) return 'vendor-icons'
}

const chunkFileNames = (chunkInfo: { name: string }) => {
  const { name } = chunkInfo
  if (name.startsWith('vendor-')) return 'vendor/[name]-[hash].js'
  return 'assets/[name]-[hash].js'
}

/** Mirror Next `raw-loader` for `*.html` imports under `src/` (email templates, etc.). */
function rawHtmlPlugin(): PluginOption {
  const srcDir = `${path.resolve(rootDir, 'src')}/`

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '')
  Object.assign(process.env, env)

  const isDev = mode !== 'production'
  const enableCodeInspector = process.env.CODE_INSPECTOR === '1'
  const nextPort = env.PORT || process.env.PORT || '3000'
  const nextTarget = `http://localhost:${nextPort}`
  const spaPort = Number(env.SPA_PORT || process.env.SPA_PORT) || 5174

  const nextPublicDefine = Object.fromEntries(
    Object.entries(process.env)
      .filter(([key]) => key.toUpperCase().startsWith('NEXT_PUBLIC_'))
      .map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)]),
  )

  return {
    // Production assets are served from Next `public/_spa` (same-origin).
    base: isDev ? '/' : '/_spa/',
    // Avoid copying Next `public/` (incl. `_spa`) into Vite `dist` — prevents nested `_spa/_spa`.
    publicDir: false,
    define: {
      __DEV__: isDev,
      ...nextPublicDefine,
      // Safe fallback so generic `process.env` access won't crash in the browser.
      'process.env': '{}',
    },
    plugins: [
      (isDev || enableCodeInspector) &&
        codeInspectorPlugin({
          bundler: 'vite',
          editor: 'cursor',
          exclude: [/\.(css|json|html)$/],
          hotKeys: ['altKey', 'shiftKey'],
          injectTo: spaEntry,
          // showSwitch: true,
        }),
      rawHtmlPlugin(),
      react(),
    ],
    resolve: {
      // SPA: Vite alias `@` → tsconfig.json paths
      tsconfigPaths: true,
      alias: {
        // SPA: Next navigation/link → react-router shims (Next build untouched)
        'next/navigation': path.resolve(rootDir, 'src/spa/shims/next-navigation.ts'),
        'next/link': path.resolve(rootDir, 'src/spa/shims/next-link.tsx'),
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react-router',
        'react-router/dom',
        'antd',
        '@ant-design/icons',
        '@lobehub/ui',
        '@lobehub/ui > @emotion/react',
        'antd-style',
        'zustand',
        'zustand/middleware',
        'swr',
        'motion/react',
        'lodash-es',
        'react-scan',
      ],
    },
    server: {
      cors: true,
      host: true,
      port: spaPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: nextTarget,
          changeOrigin: true,
        },
      },
      warmup: {
        // Only client-safe modules — avoid `src/libs/**` (DB / IM / better-auth server).
        clientFiles: [
          './src/initialize.ts',
          './src/spa/**/*.tsx',
          './src/components/**/*.{ts,tsx}',
          './src/const/**/*.ts',
          './src/features/**/*.{ts,tsx}',
          './src/hooks/**/*.{ts,tsx}',
          './src/layout/**/*.{ts,tsx}',
          './src/libs/better-auth/client/**/*.{ts,tsx}',
          './src/libs/better-auth/shared/**/*.{ts,tsx}',
          './src/libs/better-auth/email-templates/preview/**/*.ts',
          './src/libs/better-auth/email-templates/utils/**/*.ts',
          './src/libs/better-auth/email-templates/*.ts',
          './src/routes/**/*.{ts,tsx}',
          './src/services/**/*.ts',
          './src/styles/**/*.{ts,css}',
          './src/utils/**/*.{ts,tsx}',

          './packages/types/src/**/*.ts',
          './packages/const/src/**/*.ts',
          './packages/utils/src/**/*.ts',
          './packages/env/src/**/*.ts',
          './packages/fetch-sse/src/**/*.ts',
        ],
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      reportCompressedSize: false,
      rolldownOptions: {
        input: path.resolve(rootDir, 'index.html'),
        output: {
          chunkFileNames,
          strictExecutionOrder: true,
          codeSplitting: {
            groups: [
              {
                name: (moduleId: string) => manualChunks(moduleId) ?? null,
              },
            ],
          },
        },
      },
    },
  }
})
