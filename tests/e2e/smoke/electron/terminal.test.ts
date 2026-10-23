import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { expect, test } from '../../fixtures/electron.fixture'
import { createChannelResponses, startChannelServer } from '../../fixtures/channel-logs'

declare global {
  interface Window {
    terminalSmoke: { output: Record<string, string>; exited: string[]; dispose: () => void }
  }
}

test('本机终端使用真实 PTY，保留项目进程并响应中断和重载清理', async ({ electronApp, mainWindow }) => {
  test.skip(process.platform !== 'darwin', '本机终端首版仅支持 macOS')
  const temp = await mkdtemp(path.join(os.tmpdir(), 'purechat-terminal-e2e-'))
  const firstRoot = path.join(temp, '项目 A')
  const secondRoot = path.join(temp, 'project B')
  await Promise.all([mkdir(firstRoot), mkdir(secondRoot)])
  try {
    await mainWindow.evaluate(() => {
      const api = window.pureChatDesktop!.terminal
      const output: Record<string, string> = {}
      const exited: string[] = []
      const offData = api.onData(({ sessionId, data }) => {
        output[sessionId] = (output[sessionId] ?? '') + data
      })
      const offExit = api.onExit(({ sessionId }) => {
        exited.push(sessionId)
      })
      window.terminalSmoke = {
        output,
        exited,
        dispose: () => {
          offData()
          offExit()
        },
      }
    })
    const desktop = await mainWindow.evaluate(() =>
      window.pureChatDesktop!.terminal.open({ projectId: null, cols: 80, rows: 24 })
    )
    const expectedDesktop = await electronApp.evaluate(({ app }) => app.getPath('desktop'))
    expect(desktop.cwd).toBe(await realpath(expectedDesktop))
    await mainWindow.evaluate(
      (id) => window.pureChatDesktop!.terminal.resize({ sessionId: id, cols: 100, rows: 30 }),
      desktop.id
    )
    await expect.poll(() => mainWindow.evaluate((id) => window.terminalSmoke.output[id] ?? '', desktop.id)).not.toBe('')
    await mainWindow.evaluate(
      (id) => window.pureChatDesktop!.terminal.write({ sessionId: id, data: 'stty size\r' }),
      desktop.id
    )
    await expect
      .poll(() => mainWindow.evaluate((id) => window.terminalSmoke.output[id] ?? '', desktop.id))
      .toContain('30 100')

    const projects = await mainWindow.evaluate(
      async ({ firstRoot, secondRoot }) => {
        const api = window.pureChatDesktop!
        return [
          await api.createProject({ name: '终端 A', rootPath: firstRoot }),
          await api.createProject({ name: '终端 B', rootPath: secondRoot }),
        ]
      },
      { firstRoot, secondRoot }
    )
    const sessions = []
    for (const project of projects) {
      const session = await mainWindow.evaluate(
        (projectId) => window.pureChatDesktop!.terminal.open({ projectId, cols: 80, rows: 24 }),
        project.id
      )
      expect(session.cwd).toBe(await realpath(project.rootPath))
      sessions.push(session)
      await mainWindow.evaluate(
        (id) => window.pureChatDesktop!.terminal.resize({ sessionId: id, cols: 80, rows: 24 }),
        session.id
      )
    }
    const [first, second] = sessions
    await mainWindow.evaluate(
      (id) =>
        window.pureChatDesktop!.terminal.write({
          sessionId: id,
          data: "export PURECHAT_TERMINAL_SMOKE='中文'; sleep 30\r",
        }),
      first.id
    )
    await mainWindow.evaluate(
      (id) => window.pureChatDesktop!.terminal.write({ sessionId: id, data: 'printf \'\\nSECOND_%s\\n\' "$PWD"\r' }),
      second.id
    )
    await expect
      .poll(() => mainWindow.evaluate((id) => window.terminalSmoke.output[id] ?? '', second.id))
      .toContain(`SECOND_${await realpath(secondRoot)}`)
    expect(
      (
        await mainWindow.evaluate(
          (projectId) => window.pureChatDesktop!.terminal.open({ projectId, cols: 80, rows: 24 }),
          projects[0].id
        )
      ).id
    ).toBe(first.id)
    await mainWindow.evaluate((id) => window.pureChatDesktop!.terminal.write({ sessionId: id, data: '\x03' }), first.id)
    await mainWindow.evaluate(
      (id) =>
        window.pureChatDesktop!.terminal.write({
          sessionId: id,
          data: 'printf \'\\nRETAINED_%s\\n\' "$PURECHAT_TERMINAL_SMOKE"\r',
        }),
      first.id
    )
    await expect
      .poll(() => mainWindow.evaluate((id) => window.terminalSmoke.output[id] ?? '', first.id))
      .toContain('RETAINED_中文')
    await mainWindow.evaluate((id) => window.pureChatDesktop!.terminal.kill({ sessionId: id }), second.id)
    await expect.poll(() => mainWindow.evaluate(() => window.terminalSmoke.exited)).toContain(second.id)
    await mainWindow.reload()
    await mainWindow.waitForFunction(() => Boolean(window.pureChatDesktop?.terminal))
    const error = await mainWindow.evaluate(async (id) => {
      try {
        await window.pureChatDesktop!.terminal.write({ sessionId: id, data: 'pwd\r' })
        return ''
      } catch (error) {
        return String(error)
      }
    }, first.id)
    expect(error).toContain('终端已结束')
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})

test('终端入口、上下拖拽、收起恢复和项目选择联动', async ({ electronApp, mainWindow, baseURL }) => {
  test.skip(process.platform !== 'darwin', '本机终端首版仅支持 macOS')
  const context = electronApp.context()
  const responses = createChannelResponses()
  const respond = responses.respond.bind(responses)
  responses.respond = (pathname, authorization) => {
    if (pathname.startsWith('/api/chat/topics')) return { status: 200, body: [] }
    return respond(pathname, authorization)
  }
  const server = await startChannelServer(responses)
  await context.unroute('**/*')
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.protocol === 'purechat:' || url.origin === server.url) return route.continue()
    if (url.origin !== new URL(baseURL!).origin) return route.abort('blockedbyclient')
    return route.fulfill({ response: await route.fetch() })
  })
  const temp = await mkdtemp(path.join(os.tmpdir(), 'purechat-terminal-ui-'))
  await writeFile(path.join(temp, 'terminal-completion.txt'), 'COMPLETION_OK\n')
  try {
    await mainWindow.evaluate(
      async ({ serverUrl, rootPath }) => {
        const api = window.pureChatDesktop!
        await api.setRemoteServer(serverUrl)
        await api.storeSecret('auth.accessToken', 'isolated-terminal-test-token')
        await api.storeSecret('auth.expiresAt', String(Date.now() + 3600_000))
        await api.createProject({ name: '终端测试项目', rootPath })
      },
      { serverUrl: server.url, rootPath: temp }
    )
    await mainWindow.goto(baseURL!)
    await mainWindow.waitForFunction(() => Boolean(document.getElementById('root')?.childElementCount))
    await mainWindow.evaluate(() => {
      history.pushState({}, '', '/chat')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    const toggle = mainWindow.getByRole('button', { name: '终端', exact: true })
    await expect(toggle).toBeVisible()
    const panel = mainWindow.locator('[data-terminal-panel]')
    await expect(panel).toHaveAttribute('data-open', 'false')
    await toggle.click()
    expect((await panel.getByRole('toolbar').boundingBox())!.height).toBeLessThan(48)
    const input = panel.locator('textarea.xterm-helper-textarea')
    await expect(input).toBeAttached()
    await expect(panel.locator('.xterm-screen')).toContainText(/[%$#>] /)
    await input.focus()
    await mainWindow.keyboard.type("printf '\\nUI_%s\\n' 'READY'")
    await mainWindow.keyboard.press('Enter')
    await expect(panel.locator('.xterm-screen')).toContainText('UI_READY')
    const separator = panel.getByRole('separator')
    await expect(separator).toHaveAttribute('aria-valuenow', '280')
    const before = await panel.boundingBox()
    const handle = await separator.boundingBox()
    expect(before).not.toBeNull()
    expect(handle).not.toBeNull()
    const dragX = handle!.x + handle!.width / 2
    const dragY = handle!.y + handle!.height / 2
    await mainWindow.mouse.move(dragX, dragY)
    await mainWindow.mouse.down()
    await mainWindow.mouse.move(dragX, dragY - 80, { steps: 10 })
    await mainWindow.mouse.up()
    await expect.poll(async () => (await panel.boundingBox())!.height).toBeGreaterThan(before!.height + 40)
    await panel.getByRole('button', { name: '收起终端' }).click()
    await expect(panel).toHaveAttribute('data-open', 'false')
    await toggle.click()
    await expect(panel.locator('.xterm-screen')).toContainText('UI_READY')
    await panel.getByRole('combobox').click()
    await mainWindow.getByRole('option', { name: '终端测试项目' }).click()
    await expect(panel.getByText('本机终端 · 终端测试项目')).toBeVisible()
    await input.focus()
    await mainWindow.keyboard.type('printf \'\\nDIR_%s\\n\' "$PWD"')
    await mainWindow.keyboard.press('Enter')
    await expect(panel.locator('.xterm-screen')).toContainText(`DIR_${await realpath(temp)}`)
    await mainWindow.keyboard.type('cat terminal-completion')
    await mainWindow.keyboard.press('Tab')
    await mainWindow.keyboard.press('Enter')
    await expect(panel.locator('.xterm-screen')).toContainText('COMPLETION_OK')
    await input.evaluate((element) => {
      const clipboardData = new DataTransfer()
      clipboardData.setData('text/plain', "printf '\\nPASTE_%s\\n' '中文'")
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }))
    })
    await mainWindow.keyboard.press('Enter')
    await expect(panel.locator('.xterm-screen')).toContainText('PASTE_中文')
    await mainWindow.keyboard.type('vim -Nu NONE -n')
    await mainWindow.keyboard.press('Enter')
    await expect(panel.locator('.xterm-screen')).toContainText('VIM')
    await mainWindow.keyboard.type('i')
    await mainWindow.keyboard.insertText('终端交互验收')
    await expect(panel.locator('.xterm-screen')).toContainText('终端交互验收')
    await mainWindow.keyboard.press('Escape')
    await mainWindow.keyboard.type(':q!')
    await mainWindow.keyboard.press('Enter')
    await expect(panel.locator('.xterm-screen')).toContainText('PASTE_中文')
    await mainWindow.keyboard.type('clear')
    await mainWindow.keyboard.press('Enter')
    await expect(panel.locator('.xterm-screen')).not.toContainText('PASTE_中文')
    await mainWindow.keyboard.type("printf '\\nCOPY_%s\\n' 'MARKER'")
    await mainWindow.keyboard.press('Enter')
    const copyLine = panel.locator('.xterm-rows > div').filter({ hasText: /^COPY_MARKER/ })
    await expect(copyLine).toBeVisible()
    await copyLine.click({ clickCount: 3, position: { x: 5, y: 5 } })
    const copied = await input.evaluate((element) => {
      const clipboardData = new DataTransfer()
      element.dispatchEvent(new ClipboardEvent('copy', { clipboardData, bubbles: true, cancelable: true }))
      return clipboardData.getData('text/plain')
    })
    expect(copied).toContain('COPY_MARKER')
    await panel.getByRole('combobox').click()
    await mainWindow.getByRole('option', { name: '桌面', exact: true }).click()
    await expect(panel.locator('.xterm-screen')).toContainText('UI_READY')
    await mainWindow.screenshot({ path: 'test-results/terminal-panel.png' })
    await panel.getByRole('button', { name: '结束当前终端' }).click()
    await expect(panel.getByRole('button', { name: '重新打开' })).toBeVisible()
  } finally {
    await mainWindow.evaluate(() => window.pureChatDesktop!.auth.logout())
    await rm(temp, { recursive: true, force: true })
    await server.close()
  }
})
