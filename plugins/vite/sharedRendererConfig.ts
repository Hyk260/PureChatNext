import path from 'node:path'

import react from '@vitejs/plugin-react'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { type PluginOption } from 'vite'

import { viteRawHtml } from './rawHtml'

const isNodePackage = (id: string, packageName: string) => {
  const normalized = id.replaceAll('\\', '/')
  return normalized.includes(`/node_modules/${packageName}/`)
}

function sharedManualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return

  // antd：从 eager 主入口拆出，独立可缓存 vendor chunk。
  // antd 本就被 ThemeProviders eager 引用，拆出后主入口骨架降至 ~65kB，
  // 且 antd 版本稳定时跨部署可复用缓存。
  if (isNodePackage(id, 'antd')) return 'vendor-antd'

  // 注意：shiki / mermaid / katex / @lobehub/ui Markdown 仅被 chat 懒加载路由使用，
  // 不可用 codeSplitting.groups 手动命名分包 —— rolldown 会将命名 chunk 全部
  // modulepreload（eager），导致首屏额外加载 ~2.3MB。保持 rolldown 默认拆分即可懒加载。

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

const sharedChunkFileNames = (chunkInfo: { name: string }) => {
  const { name } = chunkInfo
  if (name.startsWith('vendor-')) return 'vendor/[name]-[hash].js'
  return 'assets/[name]-[hash].js'
}

interface SharedRolldownOutputOptions {
  strictExecutionOrder?: boolean
}

export const createSharedRolldownOutput = (options: SharedRolldownOutputOptions = {}) => ({
  chunkFileNames: sharedChunkFileNames,
  strictExecutionOrder: options.strictExecutionOrder ?? true,
  codeSplitting: {
    groups: [
      {
        name: (moduleId: string) => sharedManualChunks(moduleId) ?? null,
      },
    ],
  },
})

interface SharedRendererPluginsOptions {
  enableCodeInspector?: boolean
  isDev: boolean
  rootDir: string
  spaEntry: string
}

export function sharedRendererPlugins(options: SharedRendererPluginsOptions): PluginOption[] {
  const { enableCodeInspector, isDev, rootDir, spaEntry } = options

  return [
    isDev &&
      enableCodeInspector &&
      codeInspectorPlugin({
        bundler: 'vite',
        editor: 'cursor',
        exclude: [/\.(css|json|html)$/],
        hotKeys: ['altKey', 'shiftKey'],
        injectTo: spaEntry,
      }),
    viteRawHtml(rootDir),
    react(),
  ].filter(Boolean) as PluginOption[]
}

export function sharedRendererDefine(isDev: boolean) {
  const nextPublicDefine = Object.fromEntries(
    Object.entries(process.env)
      .filter(([key]) => key.toUpperCase().startsWith('NEXT_PUBLIC_'))
      .map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)])
  )

  return {
    __DEV__: isDev,
    ...nextPublicDefine,
    // Safe fallback so generic `process.env` access won't crash in the browser.
    'process.env': '{}',
  }
}

export const sharedOptimizeDeps = {
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
}

export function sharedResolveAlias(rootDir: string) {
  return {
    // SPA: Next navigation/link → react-router shims (Next build untouched)
    'next/navigation': path.resolve(rootDir, 'src/spa/shims/next-navigation.ts'),
    'next/link': path.resolve(rootDir, 'src/spa/shims/next-link.tsx'),
  }
}

export const __testing = {
  sharedManualChunks,
}
