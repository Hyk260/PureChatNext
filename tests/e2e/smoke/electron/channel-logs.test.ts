import { createChannelResponses, startChannelServer, verifyChannelDialog } from '../../fixtures/channel-logs'
import { expect, test } from '../../fixtures/electron.fixture'

test('真实协议代理携带 Bearer 读取渠道日志，远程服务不可达时保留重试入口', async ({ electronApp, mainWindow, baseURL }) => {
  const responses = createChannelResponses()
  const server = await startChannelServer(responses)
  try {
    const context = electronApp.context()
    await context.unroute('**/*')
    // Fetch the real built assets through Playwright's HTTP client to avoid
    // Electron's cached module-preload failures after the login renderer reloads.
    await context.route(`${baseURL}/**`, async (route) => {
      await route.fulfill({ response: await route.fetch() })
    })
    await context.route('https://**/*', (route) => route.abort('blockedbyclient'))
    await context.route('http://**/api/**', async (route) => {
      if (new URL(route.request().url()).origin === server.url) {
        await route.continue()
      } else {
        await route.abort('blockedbyclient')
      }
    })
    await mainWindow.evaluate(async (url) => {
      const api = window.pureChatDesktop!
      await api.setRemoteServer(url)
      await api.storeSecret('auth.accessToken', 'isolated-diagnostic-test-token')
      await api.storeSecret('auth.expiresAt', String(Date.now() + 3600_000))
    }, server.url)
    await verifyChannelDialog(mainWindow, responses, baseURL!)
    const logs = responses.requests.filter((request) => request.path.endsWith('/logs'))
    expect(logs.length).toBeGreaterThan(1)
    expect(logs.every((request) => request.authorization === 'Bearer isolated-diagnostic-test-token')).toBe(true)
    await server.close()
    await mainWindow.getByRole('dialog').getByRole('button', { name: '刷新', exact: true }).click()
    await expect(mainWindow.getByRole('dialog').getByRole('alert')).toContainText('无法读取服务端诊断日志')
    await expect(mainWindow.getByRole('dialog').getByRole('button', { name: '刷新', exact: true })).toBeEnabled()
  } finally {
    await server.close()
  }
})
