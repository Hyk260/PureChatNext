import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

import type { ElectronApplication, Page } from '@playwright/test'

import { createChannelResponses, startChannelServer } from '../../fixtures/channel-logs'
import { expect, test as baseTest } from '../../fixtures/electron.fixture'

const test = baseTest.extend({
  mainWindow: async ({ electronApp, baseURL }, run) => {
    const context = electronApp.context()
    const origin = new URL(baseURL!).origin
    await context.unroute('**/*')
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.origin !== origin || url.pathname.startsWith('/api/')) return route.abort('blockedbyclient')
      return route.fulfill({ response: await route.fetch() })
    })
    const page = await electronApp.firstWindow()
    await page.waitForURL(baseURL!, { waitUntil: 'domcontentloaded' })
    await page.goto(baseURL!)
    await page.getByRole('heading', { name: '登录以同步你的 PureChat' }).waitFor()
    await run(page)
  },
})

async function startPages() {
  const server = createServer((request, response) => {
    if (request.url === '/redirect') {
      response.writeHead(302, { Location: '/second' })
      response.end()
      return
    }
    const second = request.url === '/second'
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'DENY' })
    response.end(`<!doctype html><html><head><title>${second ? '第二页' : '浏览器测试页'}</title></head>
      <body style="background:#eef4ff;font:18px system-ui;padding:20px">
      <h1 id="heading">${second ? '第二页内容' : '待选择的页面元素'}</h1>
      <a id="next" href="/second">下一页</a><input type="password" value="do-not-copy">
      <p style="margin-top:360px">弹框下方的网页内容应保持可见</p>
      <script>window.pageMarker = 'retained';</script></body></html>`)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      }),
  }
}

async function navigateChat(page: Page, topic = 'first') {
  await page.evaluate((topicId) => {
    history.pushState({}, '', `/chat?agent=agt_inbox&topic=${topicId}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, topic)
}

async function views(app: ElectronApplication) {
  return app.evaluate(({ BrowserWindow, WebContentsView }) => {
    const window = BrowserWindow.getAllWindows()[0]
    return window.contentView.children.flatMap((view) => {
      if (!(view instanceof WebContentsView) || view.webContents === window.webContents) return []
      return [
        {
          id: view.webContents.id,
          url: view.webContents.getURL(),
          visible: view.getVisible(),
          bounds: view.getBounds(),
        },
      ]
    })
  })
}

async function selectHeading(app: ElectronApplication, id: number) {
  await app.evaluate(async ({ webContents }, contentsId) => {
    const contents = webContents.fromId(contentsId)!
    contents.focus()
    const point = await contents.executeJavaScript(
      `(() => { const r = document.querySelector('#heading').getBoundingClientRect(); return { x: Math.round(r.x + 20), y: Math.round(r.y + r.height / 2) }; })()`
    )
    contents.sendInputEvent({ type: 'mouseMove', ...point })
    contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point })
    contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point })
  }, id)
}

test('隔离浏览器通过真实 IPC 导航、截图、取消选择并在重载后释放', async ({ electronApp, mainWindow }) => {
  const pages = await startPages()
  await electronApp.context().unroute('**/*')
  try {
    const state = await mainWindow.evaluate(() =>
      window.pureChatDesktop!.browser.open({ contextKey: 'browser-security-test' })
    )
    await mainWindow.evaluate(({ sessionId, url }) => window.pureChatDesktop!.browser.navigate({ sessionId, url }), {
      sessionId: state.sessionId,
      url: pages.url,
    })
    const guest = (await views(electronApp))[0]
    const security = await electronApp.evaluate(
      ({ webContents }, id) =>
        webContents
          .fromId(id)!
          .executeJavaScript(
            `({ bridge: typeof window.pureChatDesktop, node: typeof require, ipc: typeof window.ipcRenderer })`
          ),
      guest.id
    )
    expect(security).toEqual({ bridge: 'undefined', node: 'undefined', ipc: 'undefined' })
    const blocked = await mainWindow.evaluate(async (sessionId) => {
      try {
        await window.pureChatDesktop!.browser.navigate({ sessionId, url: 'file:///etc/passwd' })
        return false
      } catch {
        return true
      }
    }, state.sessionId)
    expect(blocked).toBe(true)
    await electronApp.evaluate(({ shell }) => {
      shell.openExternal = async (url) => {
        Reflect.set(globalThis, 'browserExternalUrl', url)
      }
    })
    await mainWindow.evaluate(({ sessionId, url }) => window.pureChatDesktop!.browser.navigate({ sessionId, url }), {
      sessionId: state.sessionId,
      url: `${pages.url}/redirect`,
    })
    await mainWindow.evaluate(
      (sessionId) => window.pureChatDesktop!.browser.openExternal({ sessionId }),
      state.sessionId
    )
    expect(await electronApp.evaluate(() => Reflect.get(globalThis, 'browserExternalUrl'))).toBe(`${pages.url}/second`)
    await mainWindow.evaluate(
      (sessionId) =>
        window.pureChatDesktop!.browser.layout({ sessionId, visible: true, x: 10, y: 80, width: 600, height: 500 }),
      state.sessionId
    )
    const screenshot = await mainWindow.evaluate(
      (sessionId) => window.pureChatDesktop!.browser.capture({ sessionId }),
      state.sessionId
    )
    expect(screenshot.dataUrl).toMatch(/^data:image\/png;base64,iVBOR/)
    const pending = mainWindow.evaluate(
      (sessionId) => window.pureChatDesktop!.browser.pick({ sessionId }),
      state.sessionId
    )
    await expect
      .poll(() =>
        electronApp.evaluate(
          ({ webContents }, id) =>
            webContents
              .fromId(id)!
              .executeJavaScriptInIsolatedWorld(1001, [{ code: 'typeof window.__pureBrowserPickerCancel' }]),
          guest.id
        )
      )
      .toBe('function')
    await mainWindow.evaluate((sessionId) => window.pureChatDesktop!.browser.cancelPick({ sessionId }), state.sessionId)
    expect(await pending).toBeNull()
    await mainWindow.reload()
    await expect.poll(() => views(electronApp)).toEqual([])
  } finally {
    await pages.close()
  }
})

test('浏览器工具栏选择元素、添加截图、保留会话页面并避让菜单及图片预览', async ({
  electronApp,
  mainWindow,
  baseURL,
}) => {
  const pages = await startPages()
  const baseResponses = createChannelResponses()
  const responses = {
    ...baseResponses,
    respond: (pathname: string, authorization?: string): { status: number; body: unknown } => {
      if (pathname === '/api/chat/topics')
        return {
          status: 200,
          body: ['first', 'second'].map((id) => ({
            id,
            agentId: 'agt_inbox',
            title: id,
            permissionMode: 'auto',
            projectName: null,
            favorite: false,
            createdAt: '2026-10-26T00:00:00Z',
            updatedAt: '2026-10-26T00:00:00Z',
          })),
        }
      if (pathname.endsWith('/messages')) return { status: 200, body: [] }
      return baseResponses.respond(pathname, authorization)
    },
  }
  const server = await startChannelServer(responses)
  const context = electronApp.context()
  await context.unroute('**/*')
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.protocol === 'purechat:') return route.continue()
    const allowed = url.origin === server.url || url.origin === pages.url || url.origin === new URL(baseURL!).origin
    if (!allowed) return route.abort('blockedbyclient')
    return route.fulfill({ response: await route.fetch() })
  })
  try {
    await mainWindow.evaluate(async (serverUrl) => {
      const api = window.pureChatDesktop!
      await api.setRemoteServer(serverUrl)
      await api.storeSecret('auth.accessToken', 'isolated-browser-test-token')
      await api.storeSecret('auth.expiresAt', String(Date.now() + 3600_000))
      localStorage.setItem(
        'purechat:chat:v2:ui',
        JSON.stringify({
          version: 11,
          state: { rightCollapsed: false, workPanelOpenTabs: ['overview', 'params'], workPanelActiveTab: 'params' },
        })
      )
      localStorage.setItem(
        'purechat:layout:work-panel',
        JSON.stringify({ state: { panelWidth: 600, previewWidth: 560 }, version: 0 })
      )
      localStorage.setItem(
        'pure-home-ui',
        JSON.stringify({ state: { selectedProvider: 'openai', selectedModel: 'gpt-4o' }, version: 0 })
      )
    }, server.url)
    await mainWindow.goto(baseURL!)
    await mainWindow.waitForFunction(() => Boolean(document.getElementById('root')?.childElementCount))
    await navigateChat(mainWindow)
    await mainWindow.getByRole('button', { name: '添加面板' }).click()
    await mainWindow.getByRole('menuitem', { name: '浏览器', exact: true }).click()
    const panel = mainWindow.locator('[data-browser-panel]')
    const address = panel.getByRole('combobox', { name: '浏览器地址' })
    await address.fill(pages.url)
    await address.press('Enter')
    await expect.poll(async () => (await views(electronApp))[0]?.visible).toBe(true)
    await expect(panel.getByRole('button', { name: '框选页面元素', exact: true })).toBeEnabled()
    const guestId = (await views(electronApp))[0].id
    await panel.getByRole('button', { name: '框选页面元素', exact: true }).click()
    await expect
      .poll(() =>
        electronApp.evaluate(
          ({ webContents }, id) =>
            webContents
              .fromId(id)!
              .executeJavaScriptInIsolatedWorld(1001, [{ code: 'typeof window.__pureBrowserPickerCancel' }]),
          guestId
        )
      )
      .toBe('function')
    await selectHeading(electronApp, guestId)
    await expect(mainWindow.getByLabel('网页元素上下文')).toContainText('待选择的页面元素')
    await expect(mainWindow.getByRole('textbox', { name: '聊天输入框' })).toBeFocused()
    await panel.getByRole('button', { name: '截图并添加到输入框' }).click()
    await expect(mainWindow.getByAltText('待发送图片')).toBeVisible()

    await mainWindow.getByRole('button', { name: '添加面板' }).click()
    await expect.poll(async () => (await views(electronApp))[0]?.visible).toBe(false)
    await mainWindow.keyboard.press('Escape')
    await expect.poll(async () => (await views(electronApp))[0]?.visible).toBe(true)
    await mainWindow.getByRole('button', { name: '预览图片' }).click()
    await expect.poll(async () => (await views(electronApp))[0]?.visible).toBe(false)
    await mainWindow.locator('.lobe-image-viewer-close').click()
    await expect.poll(async () => (await views(electronApp))[0]?.visible).toBe(true)

    await address.fill(`${pages.url}/second`)
    await address.press('Enter')
    await expect(address).toHaveValue(`${pages.url}/second`)
    await panel.getByRole('button', { name: '后退', exact: true }).click()
    await expect(address).toHaveValue(`${pages.url}/`)
    await panel.getByRole('button', { name: '前进', exact: true }).click()
    await expect(address).toHaveValue(`${pages.url}/second`)

    const separator = mainWindow.getByRole('separator', { name: '调整工作面板宽度' })
    const box = await separator.boundingBox()
    expect(box!.width).toBe(6)
    const zoom = await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.getZoomFactor()
    )
    await expect
      .poll(async () => {
        const viewport = await panel.locator(':scope > div').last().boundingBox()
        const native = (await views(electronApp))[0].bounds
        return Math.abs(native.x - viewport!.x * zoom) <= 1 && Math.abs(native.width - viewport!.width * zoom) <= 1
      })
      .toBe(true)
    expect(box!.x + box!.width).toBeLessThanOrEqual((await views(electronApp))[0].bounds.x / zoom + 1)
    expect(
      await separator.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        return document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + 150) === element
      })
    ).toBe(true)
    const oldWidth = (await views(electronApp))[0].bounds.width
    await mainWindow.mouse.move(box!.x + 3, box!.y + 150)
    await mainWindow.mouse.down()
    await mainWindow.mouse.move(box!.x - 60, box!.y + 150, { steps: 5 })
    await mainWindow.mouse.up()
    await expect.poll(async () => (await views(electronApp))[0].bounds.width).toBeGreaterThan(oldWidth + 20)
    await mainWindow.getByRole('button', { name: '折叠工作面板' }).click()
    await expect.poll(async () => (await views(electronApp))[0]?.visible).toBe(false)
    await mainWindow.getByRole('button', { name: '展开工作面板' }).click()
    await expect.poll(async () => (await views(electronApp))[0]?.visible).toBe(true)

    await navigateChat(mainWindow, 'second')
    await expect.poll(async () => (await views(electronApp))[0]?.visible).toBe(false)
    await expect(mainWindow.getByLabel('网页元素上下文')).toHaveCount(0)
    await navigateChat(mainWindow)
    await expect(address).toHaveValue(`${pages.url}/second`)
    await expect.poll(async () => (await views(electronApp))[0]?.visible).toBe(true)
    await expect(mainWindow.getByLabel('网页元素上下文')).toContainText('待选择的页面元素')
    await mainWindow.getByRole('button', { name: '关闭第二页' }).click()
    await expect.poll(() => views(electronApp)).toEqual([])
    await mainWindow.getByRole('button', { name: '添加面板' }).click()
    await mainWindow.getByRole('menuitem', { name: '浏览器', exact: true }).click()
    await expect(address).toHaveValue('')
    await expect(mainWindow.getByRole('menu')).toHaveCount(0)
    await address.click()
    const history = mainWindow.getByRole('listbox', { name: '浏览历史' })
    await expect(history.getByRole('option')).toHaveCount(2)
    await address.fill('第二页')
    await expect(history.getByRole('option')).toHaveCount(1)
    await address.press('ArrowDown')
    await address.press('Enter')
    await expect(address).toHaveValue(`${pages.url}/second`)

    for (let index = 0; index < 6; index += 1) {
      await address.fill(`${pages.url}/history-${index}`)
      await address.press('Enter')
      await expect.poll(async () => (await views(electronApp))[0]?.url).toBe(`${pages.url}/history-${index}`)
      await expect
        .poll(() =>
          mainWindow.evaluate((url) => {
            const saved = JSON.parse(localStorage.getItem('purechat:browser:v1:history') || '{}')
            const histories = Object.values<Array<{ url: string }>>(saved.state?.byScope ?? {})
            return histories.flat().some((item) => item.url === url)
          }, `${pages.url}/history-${index}`)
        )
        .toBe(true)
    }
    await address.blur()
    await address.click()
    await expect(history.getByRole('option')).toHaveCount(5)
    await expect(history.getByRole('option').first()).toContainText('/history-5')
    await expect(history.getByRole('option').last()).toContainText('/history-1')
    await expect(history).not.toContainText('/history-0')
    await expect.poll(async () => (await views(electronApp))[0]?.visible).toBe(false)
    const viewport = panel.locator(':scope > div').last()
    await expect
      .poll(() => viewport.evaluate((element) => element.style.backgroundImage))
      .toContain('data:image/png;base64,')
    await mainWindow.screenshot({ path: 'test-results/browser-history-overlay.png' })
    await address.fill('HISTORY-3')
    await expect(history.getByRole('option')).toHaveCount(1)
    await history.getByRole('option').click()
    await expect(address).toHaveValue(`${pages.url}/history-3`)
    await address.blur()
    await address.click()
    await expect(history.getByRole('option')).toHaveCount(5)
    await expect(history.getByRole('option').first()).toContainText('/history-3')
    await address.press('Escape')
    await expect(history).toHaveCount(0)
    await expect.poll(async () => (await views(electronApp))[0]?.visible).toBe(true)
    await expect.poll(() => viewport.evaluate((element) => element.style.backgroundImage)).toBe('')

    await navigateChat(mainWindow, 'second')
    await mainWindow.getByRole('button', { name: '添加面板' }).click()
    await mainWindow.getByRole('menuitem', { name: '浏览器', exact: true }).click()
    await address.click()
    await expect(history.getByRole('option')).toHaveCount(5)
    await mainWindow.screenshot({ path: 'test-results/browser-panel.png' })
    await mainWindow.evaluate(() => window.pureChatDesktop!.auth.logout())
    await expect.poll(() => views(electronApp)).toEqual([])
  } catch (error) {
    await test.info().attach('browser-history-state', {
      body: JSON.stringify({
        renderer: await mainWindow.evaluate(() => ({
          history: localStorage.getItem('purechat:browser:v1:history'),
          toolbar: document.querySelector('[data-browser-panel]')?.textContent,
          address: document.querySelector<HTMLInputElement>('[aria-label="浏览器地址"]')?.value,
          progress: document.querySelector('[aria-label="网页加载中"]') !== null,
        })),
        guests: await electronApp.evaluate(({ webContents }) =>
          webContents.getAllWebContents().map((contents) => ({
            url: contents.getURL(),
            loading: contents.isLoading(),
            type: contents.getType(),
          }))
        ),
      }),
      contentType: 'application/json',
    })
    throw error
  } finally {
    await mainWindow.evaluate(() => window.pureChatDesktop!.auth.logout()).catch(() => undefined)
    await server.close()
    await pages.close()
  }
})
