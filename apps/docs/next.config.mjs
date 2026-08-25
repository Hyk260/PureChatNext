import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/index.md', destination: '/raw-content' },
      { source: '/:path*.md', destination: '/raw-content/:path*' },
    ]
  },
}

export default withMDX(config)
