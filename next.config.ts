import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  compress: isProd, // 启用压缩（生产环境）
  // 启用实验性功能以提高性能
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // 优化图片和静态资源
  images: {
    remotePatterns: [],
  },
  // 启用严格模式（开发环境）
  // reactStrictMode: true,
};

export default nextConfig;
