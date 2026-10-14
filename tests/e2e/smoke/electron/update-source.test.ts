import { createChannelResponses, startChannelServer } from '../../fixtures/channel-logs'
import { expect, test } from '../../fixtures/electron.fixture'

test('更新来源通过真实 IPC 保存，草稿和无效地址不影响当前来源', async ({ electronApp, mainWindow, baseURL }) => {
  const server = await startChannelServer(createChannelResponses())
  try {
    // The smoke bootstrap runs as Electron's default app; use the actual desktop
    // directory so its dev-app-update.yml and cache configuration can be read.
    await electronApp.evaluate(({ app }) => {
      const desktopDir = `${process.cwd()}/apps/desktop`
      app.getAppPath = () => desktopDir
    })
    const context = electronApp.context()
    await context.unroute('**/*')
    await context.route(`${baseURL}/**`, async (route) => {
      await route.fulfill({ response: await route.fetch() })
    })
    await context.route('https://**/*', (route) => route.abort('blockedbyclient'))
    await mainWindow.evaluate(async (url) => {
      const api = window.pureChatDesktop!
      await api.setRemoteServer(url)
      await api.storeSecret('auth.accessToken', 'isolated-update-source-test-token')
      await api.storeSecret('auth.expiresAt', String(Date.now() + 3600_000))
      const state = await api.updater.getState()
      await api.updater.setPreferences({ ...state.preferences, autoUpdate: false })
    }, server.url)
    const openAbout = async () => {
      await mainWindow.goto(baseURL!)
      await mainWindow.waitForFunction(() => Boolean(document.getElementById('root')?.childElementCount))
      await mainWindow.evaluate(() => {
        history.pushState({}, '', '/settings/about')
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
    }
    await openAbout()
    const select = mainWindow.getByLabel('更新来源', { exact: true })
    const save = mainWindow.getByRole('button', { name: '保存更新来源' })
    const input = mainWindow.getByRole('textbox', { name: '自定义更新地址' })
    await expect(select).toBeVisible()
    await select.click()
    await mainWindow.getByRole('option', { name: '自定义', exact: true }).click()
    await expect(input).toBeVisible()
    await expect(save).toBeDisabled()
    await input.fill('file:///tmp/releases')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(save).toBeDisabled()
    await input.fill(` ${server.url}/desktop/ `)
    await expect(save).toBeEnabled()
    expect((await mainWindow.evaluate(() => window.pureChatDesktop!.updater.getState())).effectiveSource).toBeNull()
    await save.click()
    await expect(mainWindow.getByText(`当前来源：${server.url}/desktop/`, { exact: true })).toBeVisible()
    await expect(save).toBeDisabled()
    const saved = await mainWindow.evaluate(() => window.pureChatDesktop!.updater.getState())
    expect(saved).toMatchObject({ preferences: { autoUpdate: false, updateSource: 'custom', customUpdateUrl: `${server.url}/desktop/` } })

    await select.click()
    await mainWindow.getByRole('option', { name: 'GitHub', exact: true }).click()
    expect((await mainWindow.evaluate(() => window.pureChatDesktop!.updater.getState())).effectiveSource).toEqual(saved.effectiveSource)
    await save.click()
    await expect(mainWindow.getByText('当前来源：Hyk260/PureChatNext', { exact: true })).toBeVisible()
    await select.click()
    await mainWindow.getByRole('option', { name: '自定义', exact: true }).click()
    await expect(input).toHaveValue(`${server.url}/desktop/`)
    await select.click()
    await mainWindow.getByRole('option', { name: '本地', exact: true }).click()
    await save.click()
    await expect(mainWindow.getByText('当前来源：http://127.0.0.1:5500', { exact: true })).toBeVisible()
    await openAbout()
    await expect(mainWindow.getByText('当前来源：http://127.0.0.1:5500', { exact: true })).toBeVisible()
  } finally {
    await server.close()
  }
})
