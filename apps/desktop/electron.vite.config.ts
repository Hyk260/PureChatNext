import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'electron-vite'
import { loadEnv, type PluginOption } from 'vite'

import {
  sharedOptimizeDeps,
  sharedRendererDefine,
  sharedRendererPlugins,
  sharedResolveAlias,
} from '../../plugins/vite/sharedRendererConfig'

const desktopDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(desktopDir, '../..')
const desktopEnv = loadEnv('desktop', desktopDir, '')
for (const [key, value] of Object.entries(desktopEnv)) {
  if (process.env[key] === undefined) process.env[key] = value
}

const nextPort = Number(process.env.PORT) || 3000
const rendererPort = Number(process.env.PURECHAT_DESKTOP_VITE_PORT) || 5176
const isDev = process.env.NODE_ENV !== 'production'

export default defineConfig({
  main: {
    build: {
      outDir: path.resolve(desktopDir, 'dist/main'),
      sourcemap: process.env.NODE_ENV !== 'production',
    },
  },
  preload: {
    build: {
      outDir: path.resolve(desktopDir, 'dist/preload'),
      rollupOptions: {
        output: {
          entryFileNames: 'index.cjs',
          format: 'cjs',
        },
      },
      sourcemap: process.env.NODE_ENV !== 'production',
    },
  },
  renderer: {
    root: desktopDir,
    base: '/',
    build: {
      outDir: path.resolve(desktopDir, 'dist/renderer'),
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(desktopDir, 'index.html'),
      },
    },
    define: {
      ...sharedRendererDefine(isDev),
      __ELECTRON__: 'true',
    },
    optimizeDeps: sharedOptimizeDeps,
    plugins: sharedRendererPlugins({
      enableCodeInspector: process.env.CODE_INSPECTOR === '1',
      isDev,
      rootDir,
      spaEntry: path.resolve(rootDir, 'src/spa/entry.desktop.tsx'),
    }) as PluginOption[],
    resolve: {
      alias: {
        '@/envs': path.resolve(rootDir, 'packages/env/src'),
        '@': path.resolve(rootDir, 'src'),
        ...sharedResolveAlias(rootDir),
      },
      dedupe: ['react', 'react-dom'],
      tsconfigPaths: true,
    },
    server: {
      fs: {
        allow: [rootDir],
      },
      host: '127.0.0.1',
      port: rendererPort,
      strictPort: true,
      proxy: {
        '/api': {
          changeOrigin: true,
          target: `http://localhost:${nextPort}`,
        },
      },
    },
  },
})
