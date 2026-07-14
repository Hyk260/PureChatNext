import path from 'node:path'

import type { NextConfig } from 'next'
import { codeInspectorPlugin } from 'code-inspector-plugin'

const isProd = process.env.NODE_ENV === 'production'
const isVercel = !!process.env.VERCEL_ENV

/** Absolute path required by code-inspector `injectTo` (shared client entry). */
const codeInspectorInjectTo = path.join(process.cwd(), 'src/components/CodeInspectorAnchor.tsx')

const nextConfig: NextConfig = {
  ...(isVercel
    ? {
        outputFileTracingExcludes: {
          '*': [
            'node_modules/.pnpm/@napi-rs+canvas-*-musl*',
            'node_modules/.pnpm/@img+sharp-libvips-*musl*',
          ],
        },
      }
    : {}),
  compress: isProd,
  compiler: {
    emotion: true,
  },
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['@lobehub/ui', 'lucide-react', 'antd'],
    webVitalsAttribution: ['CLS', 'LCP'],
  },
  logging: {
    fetches: {
      fullUrl: true,
      hmrRefreshes: true,
    },
  },
  async headers() {
    const securityHeaders = [
      {
        key: 'x-robots-tag',
        value: 'all',
      },
    ]

    return [
      {
        headers: securityHeaders,
        source: '/:path*',
      },
    ]
  },
  images: {
    remotePatterns: [],
  },
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'],
  turbopack: {
    rules: codeInspectorPlugin({
      bundler: 'turbopack',
      showSwitch: true,
      editor: 'cursor',
      injectTo: codeInspectorInjectTo,
      // hotKeys: ['altKey', 'shiftKey'],
    }),
  },
}

export default nextConfig
