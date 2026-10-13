import { mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ElectronApplication, Page } from '@playwright/test'
import { _electron, test as base } from '@playwright/test'

type ElectronFixtures = {
  electronApp: ElectronApplication
  mainWindow: Page
}

const rootDir = fileURLToPath(new URL('../../../', import.meta.url))
const desktopRequire = createRequire(path.join(rootDir, 'apps/desktop/package.json'))
const executablePath: string = desktopRequire('electron')
const bootstrapPath = fileURLToPath(new URL('./electron-bootstrap.mjs', import.meta.url))

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, run, testInfo) => {
    const rendererUrl = testInfo.project.use.baseURL
    if (!rendererUrl) throw new Error('Electron project requires a renderer baseURL')
    const profileRoot = await mkdtemp(path.join(os.tmpdir(), 'purechat-e2e-'))
    let electronApp: ElectronApplication | undefined
    let appClosed = false
    let tracingStarted = false
    try {
      electronApp = await _electron.launch({
        executablePath,
        args: [bootstrapPath, `--e2e-profile=${profileRoot}`],
        cwd: rootDir,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          ELECTRON_RENDERER_URL: rendererUrl,
          PURECHAT_DESKTOP_REMOTE_URL: '',
          PURECHAT_DESKTOP_CLOUD_URL: '',
          PURECHAT_DESKTOP_UPDATE_URL: '',
          APP_URL: '',
        },
        locale: 'zh-CN',
        timeout: 60_000,
        recordVideo: { dir: testInfo.outputPath('videos') },
      })
      const context = electronApp.context()
      context.setDefaultTimeout(15_000)
      context.setDefaultNavigationTimeout(30_000)
      const origin = new URL(rendererUrl).origin
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url())
        if (url.origin === origin && !url.pathname.startsWith('/api/')) {
          await route.continue()
        } else {
          await route.abort('blockedbyclient')
        }
      })
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
      tracingStarted = true
      await run(electronApp)
    } finally {
      try {
        if (electronApp) {
          const failed = testInfo.status !== testInfo.expectedStatus
          const pages = electronApp.windows()
          const videos = pages.map((page) => page.video()).filter((video) => video !== null)
          if (failed) {
            for (const [index, page] of pages.entries()) {
              const screenshotPath = testInfo.outputPath(`window-${index}.png`)
              try {
                await page.screenshot({ path: screenshotPath, timeout: 5_000 })
                await testInfo.attach(`window-${index}`, { path: screenshotPath, contentType: 'image/png' })
              } catch (error) {
                // A crashed renderer must not prevent trace/video capture or replace the original failure.
                await testInfo.attach(`window-${index}-capture-error`, {
                  body: String(error),
                  contentType: 'text/plain',
                })
              }
            }
          }
          const tracePath = failed ? testInfo.outputPath('trace.zip') : undefined
          if (tracingStarted) {
            await electronApp.context().tracing.stop({ path: tracePath })
            if (tracePath) await testInfo.attach('trace', { path: tracePath, contentType: 'application/zip' })
          }
          await electronApp.close()
          appClosed = true
          for (const [index, video] of videos.entries()) {
            if (failed) {
              await testInfo.attach(`video-${index}`, { path: await video.path(), contentType: 'video/webm' })
            } else {
              await video.delete()
            }
          }
        }
      } finally {
        // Also close after an artifact capture failure, before removing this test's profile.
        try {
          if (electronApp && !appClosed) await electronApp.close()
        } finally {
          await rm(profileRoot, { recursive: true, force: true })
        }
      }
    }
  },
  mainWindow: async ({ electronApp }, run) => {
    const mainWindow = await electronApp.firstWindow()
    await mainWindow.getByRole('heading', { name: '登录以同步你的 PureChat' }).waitFor()
    await mainWindow.getByLabel('PureChat 服务地址').waitFor()
    await run(mainWindow)
  },
})

export { expect } from '@playwright/test'
