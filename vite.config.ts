import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DevTools } from '@vitejs/devtools'
import type { PluginOption } from 'vite'
import { defineConfig, loadEnv } from 'vite'

import {
  createSharedRolldownOutput,
  sharedOptimizeDeps,
  sharedRendererDefine,
  sharedRendererPlugins,
  sharedResolveAlias,
} from './plugins/vite/sharedRendererConfig'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const spaEntry = path.resolve(rootDir, 'src/spa/entry.web.tsx')

/**
 * Vite `server.allowedHosts` from env.
 * - `true` / `1` / `*` → allow any Host（仅本地临时隧道；有 DNS rebinding 风险）
 * - 逗号分隔主机名；前缀 `.` 表示含子域（如 `.trycloudflare.com` 覆盖随机 quick tunnel）
 */
function resolveAllowedHosts(raw?: string): true | string[] | undefined {
  const value = raw?.trim()
  if (!value) return undefined
  if (value === '1' || value === 'true' || value === '*') return true
  const hosts = value
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
  return hosts.length > 0 ? hosts : undefined
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '')
  Object.assign(process.env, env)

  const isDev = mode !== 'production'
  const enableCodeInspector = process.env.CODE_INSPECTOR === '1'
  const enableViteDevTools = process.env.VITE_DEVTOOLS === '1'
  const nextPort = env.PORT || process.env.PORT || '3000'
  const nextTarget = `http://localhost:${nextPort}`
  const spaPort = Number(env.SPA_PORT || process.env.SPA_PORT) || 5174
  const allowedHosts = resolveAllowedHosts(env.VITE_ALLOWED_HOSTS || process.env.VITE_ALLOWED_HOSTS)

  return {
    // Production assets are served from Next `public/_spa` (same-origin).
    base: isDev ? '/' : '/_spa/',
    // Avoid copying Next `public/` (incl. `_spa`) into Vite `dist` — prevents nested `_spa/_spa`.
    publicDir: false,
    define: sharedRendererDefine(isDev),
    plugins: [
      enableViteDevTools &&
        DevTools({
          build: {
            withApp: true,
          },
        }),
      ...sharedRendererPlugins({
        enableCodeInspector,
        isDev,
        rootDir,
        spaEntry,
      }),
    ].filter(Boolean) as PluginOption[],
    resolve: {
      // SPA: Vite alias `@` → tsconfig.json paths
      tsconfigPaths: true,
      alias: sharedResolveAlias(rootDir),
      dedupe: ['@lobehub/icons', '@lobehub/ui'],
    },
    optimizeDeps: sharedOptimizeDeps,
    server: {
      ...(allowedHosts !== undefined ? { allowedHosts } : {}),
      cors: true,
      host: true,
      port: spaPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: nextTarget,
          changeOrigin: true,
        },
      },
      warmup: {
        // Only client-safe modules — avoid `src/libs/**` (DB / IM / better-auth server).
        clientFiles: [
          './src/initialize.ts',
          './src/spa/**/*.tsx',
          './src/components/**/*.{ts,tsx}',
          './src/const/**/*.ts',
          './src/features/**/*.{ts,tsx}',
          './src/hooks/**/*.{ts,tsx}',
          './src/layout/**/*.{ts,tsx}',
          './src/libs/better-auth/client/**/*.{ts,tsx}',
          './src/libs/better-auth/shared/**/*.{ts,tsx}',
          './src/libs/better-auth/email-templates/preview/**/*.ts',
          './src/libs/better-auth/email-templates/utils/**/*.ts',
          './src/libs/better-auth/email-templates/*.ts',
          './src/routes/**/*.{ts,tsx}',
          './src/services/**/*.ts',
          './src/styles/**/*.{ts,css}',
          './src/utils/**/*.{ts,tsx}',

          './packages/types/src/**/*.ts',
          './packages/const/src/**/*.ts',
          './packages/utils/src/**/*.ts',
          './packages/env/src/**/*.ts',
          './packages/fetch-sse/src/**/*.ts',
        ],
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1000,
      rolldownOptions: {
        ...(enableViteDevTools && { devtools: {} }),
        input: path.resolve(rootDir, 'index.html'),
        output: createSharedRolldownOutput({ strictExecutionOrder: true }),
      },
    },
  }
})
