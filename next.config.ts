import type { NextConfig } from 'next'
import { codeInspectorPlugin } from 'code-inspector-plugin'

const isProd = process.env.NODE_ENV === 'production'

const nextConfig: NextConfig = {
  // 启用压缩
  compress: isProd,
  // 启用实验性功能以提高性能
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
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
  // 优化图片和静态资源
  images: {
    remotePatterns: [],
  },
  // 启用严格模式（开发环境）
  // reactStrictMode: true,
  turbopack: {
    rules: codeInspectorPlugin({
      bundler: 'turbopack',
    }),
  },
}

export default nextConfig
