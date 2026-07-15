import { codeInspectorPlugin } from 'code-inspector-plugin'
import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'
const isVercel = !!process.env.VERCEL_ENV
const enableCodeInspector = process.env.CODE_INSPECTOR === '1'

const nextConfig: NextConfig = {
  ...(isVercel && {
    outputFileTracingExcludes: {
      '*': [
        'node_modules/.pnpm/@napi-rs+canvas-*-musl*',
        'node_modules/.pnpm/@img+sharp-libvips-*musl*',
      ],
    },
  }),
  compress: isProd,
  compiler: {
    emotion: true,
  },
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [
      '@ant-design/icons',
      '@lobehub/icons',
      '@lobehub/ui',
      'antd',
      'lodash-es',
      'lucide-react',
    ],
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
    ]
  },
  images: {
    remotePatterns: [],
  },
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'],
  ...(enableCodeInspector && {
    turbopack: {
      rules: codeInspectorPlugin({
        bundler: 'turbopack',
        // editor: 'cursor',
        // launchType: 'open',
        // port: 5678,
        // printServer: true,
      }),
    },
  }),
}

export default nextConfig
