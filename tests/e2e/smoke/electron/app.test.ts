import { expect, test } from '../../fixtures/electron.fixture'

test('主窗口使用独立的未登录配置正常启动', async ({ electronApp, mainWindow }) => {
  const windowState = await electronApp.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    return { visible: window.isVisible(), ...window.getBounds() }
  })
  expect(windowState.visible).toBe(true)
  expect(windowState.width).toBeGreaterThanOrEqual(860)
  expect(windowState.height).toBeGreaterThanOrEqual(520)
  await expect(mainWindow.getByRole('heading', { name: '登录以同步你的 PureChat' })).toBeVisible()
  expect(await mainWindow.evaluate(() => window.pureChatDesktop?.getRemoteServer())).toEqual({ url: null })
  expect(await mainWindow.evaluate(() => window.pureChatDesktop?.auth.getStatus())).toEqual({ status: 'signedOut' })
})

test('服务地址输入控制授权按钮状态', async ({ mainWindow }) => {
  const serverInput = mainWindow.getByLabel('PureChat 服务地址')
  const authorizeButton = mainWindow.getByRole('button', { name: '连接服务器并授权' })
  await expect(authorizeButton).toBeDisabled()

  await serverInput.fill('http://127.0.0.1:5174')
  await expect(authorizeButton).toBeEnabled()
  await serverInput.clear()
  await expect(authorizeButton).toBeDisabled()
})

test('真实 preload 和 IPC 读取应用信息并保存服务配置', async ({ electronApp, mainWindow }) => {
  const appInfo = await mainWindow.evaluate(() => window.pureChatDesktop?.getAppInfo())
  expect(appInfo).toEqual({ isPackaged: false, platform: process.platform, version: expect.any(String) })
  expect(await mainWindow.evaluate(() => window.pureChatDesktop?.getRemoteServer())).toEqual({ url: null })

  const saved = await mainWindow.evaluate(() => window.pureChatDesktop?.setRemoteServer('http://127.0.0.1:5174/'))
  expect(saved).toEqual({ url: 'http://127.0.0.1:5174' })
  expect(await mainWindow.evaluate(() => window.pureChatDesktop?.getRemoteServer())).toEqual({
    url: 'http://127.0.0.1:5174',
  })
  const dataInfo = await mainWindow.evaluate(() => window.pureChatDesktop?.getDataInfo())
  const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  expect(dataInfo?.dataPath).toBe(userData)
  expect(userData).toContain('purechat-e2e-')
})
