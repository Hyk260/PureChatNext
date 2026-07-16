import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const resolveNextProxyTarget = (env: Record<string, string>) => {
  const port = env.PORT || process.env.PORT || '3000'
  return `http://localhost:${port}`
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '')
  const nextTarget = resolveNextProxyTarget(env)

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@/envs': path.resolve(rootDir, 'packages/env/src'),
        '@': path.resolve(rootDir, 'src'),
      },
    },
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': {
          target: nextTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  }
})
