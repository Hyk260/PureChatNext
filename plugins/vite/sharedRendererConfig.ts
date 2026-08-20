import path from 'node:path'

import react from '@vitejs/plugin-react'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import type { PluginOption } from 'vite'

import { htmlBuildTimePlugin } from './htmlBuildTime'
import { viteRawHtml } from './rawHtml'

const isNodePackage = (id: string, packageName: string) => {
  const normalized = id.replaceAll('\\', '/')
  return normalized.includes(`/node_modules/${packageName}/`)
}

const maxVendorChunkSize = 700 * 1024

function sharedManualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return

  // beautiful-mermaid statically imports ELK's 1.6 MB bundled layout engine.
  // ELK is a single generated module, so maxSize cannot split it any further;
  // isolate it from the surrounding Markdown/Mermaid dependencies instead.
  if (isNodePackage(id, 'elkjs')) return 'vendor-diagram-engine'
  if (isNodePackage(id, 'beautiful-mermaid')) return 'vendor-diagram-renderer'

  // @primer/octicons ships its complete icon catalog as one large JSON module.
  // Keep that route-specific data out of the generic shared vendor chunks.
  if (isNodePackage(id, '@primer/octicons')) return 'vendor-octicons'

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
  if (name.startsWith('vendor-lobehub-ui')) return 'vendor/lobehub-ui-[hash].js'
  if (name.startsWith('vendor-shared')) return 'vendor/shared-[hash].js'
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
        // The @lobehub/ui root barrel eagerly imports every CSS-bearing component.
        // Keep route-specific modules separate and cap each resulting vendor chunk.
        entriesAware: true,
        includeDependenciesRecursively: false,
        maxSize: maxVendorChunkSize,
        name: 'vendor-lobehub-ui',
        priority: 10,
        test: (moduleId: string) => isNodePackage(moduleId, '@lobehub/ui'),
      },
      {
        maxSize: maxVendorChunkSize,
        name: (moduleId: string) => sharedManualChunks(moduleId) ?? null,
      },
      {
        entriesAware: true,
        includeDependenciesRecursively: false,
        maxSize: maxVendorChunkSize,
        minSize: maxVendorChunkSize,
        name: 'vendor-shared',
        test: (moduleId: string) => moduleId.includes('node_modules'),
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
    htmlBuildTimePlugin,
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
    '@lobehub/ui/base-ui',
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
