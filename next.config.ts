import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
