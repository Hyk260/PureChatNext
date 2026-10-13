import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, devices } from '@playwright/test'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const desktopRendererUrl = process.env.ELECTRON_RENDERER_URL || 'http://127.0.0.1:5176'
const desktopUrl = new URL(desktopRendererUrl)
if (desktopUrl.protocol !== 'http:' || desktopUrl.hostname !== '127.0.0.1' || !desktopUrl.port) {
  throw new Error('ELECTRON_RENDERER_URL must use http://127.0.0.1:<port> for Electron smoke tests')
}
const desktopRendererPort = Number(desktopUrl.port)

export default defineConfig({
  testDir: './tests/e2e/smoke',
  testMatch: '**/*.test.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }], ['list']],
  outputDir: './test-results',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: 'zh-CN',
  },
  projects: [
    {
      name: 'web',
      testMatch: 'web/**/*.test.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5174' },
    },
    {
      name: 'electron',
      testMatch: 'electron/**/*.test.ts',
      // The Electron fixture owns diagnostics for its manually launched context.
      use: { baseURL: desktopRendererUrl, trace: 'off', screenshot: 'off', video: 'off' },
    },
  ],
  webServer: [
    {
      command: 'pnpm dev:spa',
      cwd: rootDir,
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: { SPA_PORT: '5174' },
    },
    {
      command: `pnpm build:desktop && pnpm exec vite preview --config tests/e2e/fixtures/desktop-preview.config.ts --port ${desktopRendererPort}`,
      cwd: rootDir,
      url: desktopRendererUrl,
      reuseExistingServer: false,
      timeout: 300_000,
      env: { APP_URL: '', PURECHAT_DESKTOP_CLOUD_URL: '' },
    },
  ],
})
