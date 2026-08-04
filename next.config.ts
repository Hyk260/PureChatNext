import { codeInspectorPlugin } from 'code-inspector-plugin'
import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'
const isVercel = !!process.env.VERCEL_ENV
const isDocker = process.env.DOCKER === 'true'
const enableCodeInspector = process.env.CODE_INSPECTOR === '1'

const nextConfig: NextConfig = {
  ...(isDocker && { output: 'standalone' as const }),
  ...(isVercel && {
    outputFileTracingExcludes: {
      '*': ['node_modules/.pnpm/@napi-rs+canvas-*-musl*', 'node_modules/.pnpm/@img+sharp-libvips-*musl*'],
    },
  }),
  compress: isProd,
  compiler: {
    emotion: true,
  },
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['@ant-design/icons', '@lobehub/icons', '@lobehub/ui', 'antd', 'lodash-es', 'lucide-react'],
    webVitalsAttribution: ['CLS', 'LCP'],
  },
  logging: {
    fetches: {
      fullUrl: true,
      hmrRefreshes: true,
    },
  },
  async headers() {
    return [
      {
        headers: [{ key: 'x-robots-tag', value: 'all' }],
        source: '/:path*',
      },
      {
        // Hashed Vite assets under public/_spa — long cache
        source: '/_spa/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  async rewrites() {
    return {
      // After pages / API / public files: unmatched UI paths → SPA HTML shell
      fallback: [
        {
          source: '/:path*',
          destination: '/spa/:path*',
        },
      ],
    }
  },
  images: {
    remotePatterns: [],
  },
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'],
  turbopack: {
    rules: {
      '*.html': {
        loaders: ['raw-loader'],
        as: '*.js',
      },
      ...(enableCodeInspector
        ? codeInspectorPlugin({
            bundler: 'turbopack',
            // editor: 'cursor',
            // launchType: 'open',
            // port: 5678,
            // printServer: true,
          })
        : {}),
    },
  },
}

export default nextConfig
