import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

import type { ChannelGatewayLogs } from '@pure/types'
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

const user = { id: 'diagnostic-test-user', name: 'Diagnostic Test', email: 'test@example.com', role: 'user', emailVerified: true }

export function createChannelResponses() {
  const requests: Array<{ path: string; authorization?: string }> = []
  let logs: ChannelGatewayLogs = { text: '', truncated: false }
  let fail = false
  return {
    requests,
    setLogs: (next: ChannelGatewayLogs) => { logs = next },
    setFailure: (next: boolean) => { fail = next },
    respond(path: string, authorization?: string) {
      requests.push({ path, authorization })
      if (path.endsWith('/logs')) return { status: fail ? 503 : 200, body: fail ? { error: 'unavailable' } : logs }
      if (path === '/api/auth/get-session') return { status: 200, body: { user, session: { id: 'test-session', userId: user.id, expiresAt: '2099-01-01T00:00:00.000Z' } } }
      if (path === '/api/auth/me') return { status: 200, body: { data: { ...user, fullName: user.name } } }
      if (path === '/api/agents') return { status: 200, body: [] }
      if (path === '/api/channels/qq/status') return { status: 200, body: { connected: false, enabled: true, applicationId: 'test-app', gatewaySupported: false, connectionMode: 'webhook', runtimeStatus: 'offline' } }
      if (path === '/api/channels/wechat/status') return { status: 200, body: { bound: false, connected: false, gatewaySupported: false, needsRebind: false, failedEventCount: 0, runtimeStatus: 'stopped' } }
      return { status: 404, body: { error: 'Unconfigured test API' } }
    },
  }
}

export type ChannelResponses = ReturnType<typeof createChannelResponses>

export async function startChannelServer(responses: ChannelResponses) {
  const server = createServer((request, response) => {
    const path = new URL(request.url || '/', 'http://127.0.0.1').pathname
    const result = responses.respond(path, request.headers.authorization)
    response.writeHead(result.status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' })
    response.end(JSON.stringify(result.body))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return {
    url,
    close: () => new Promise<void>((resolve, reject) => {
      if (!server.listening) return resolve()
      server.close((error) => error ? reject(error) : resolve())
      server.closeAllConnections()
    }),
  }
}

export async function verifyChannelDialog(page: Page, responses: ChannelResponses, baseURL: string) {
  const logCount = () => responses.requests.filter((request) => request.path.endsWith('/logs')).length
  // Desktop assets use a relative base: boot at the root, then use SPA navigation.
  await page.goto(baseURL)
  await page.waitForFunction(() => Boolean(document.getElementById('root')?.childElementCount))
  await navigateWithinSpa(page, '/settings/messenger/qq')
  const entry = page.getByRole('button', { name: '查看 QQ 网关诊断日志' })
  await expect(entry).toBeVisible()
  expect(logCount()).toBe(0)
  await entry.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('QQ Webhook 模式无需常驻 Gateway，可查看回调诊断。')).toBeVisible()
  await expect(dialog.getByLabel('服务端诊断日志')).toHaveText('暂无服务端诊断记录。')
  await page.clock.install()
  responses.setLogs({ text: '2026-10-13T00:00:00Z [INFO] [online] 网关已上线', truncated: true })
  await page.clock.fastForward(5_100)
  await expect(dialog.getByLabel('服务端诊断日志')).toContainText('网关已上线')
  await expect(dialog.getByText(/已达到保留或显示上限/)).toBeVisible()

  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }))
  const hiddenCount = logCount()
  await page.clock.fastForward(6_000)
  expect(logCount()).toBe(hiddenCount)
  await page.evaluate(() => { Reflect.deleteProperty(document, 'hidden') })
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const closedCount = logCount()
  await page.clock.fastForward(6_000)
  expect(logCount()).toBe(closedCount)

  responses.setLogs({ text: '微信测试诊断', truncated: false })
  await navigateWithinSpa(page, '/settings/messenger/wechat')
  await page.getByRole('button', { name: '查看微信网关诊断日志' }).click()
  await expect(page.getByRole('dialog').getByText(/当前部署不支持常驻 Gateway/)).toBeVisible()
  // Same user/server, different platform: QQ's cached text must not appear here.
  await expect(page.getByRole('dialog').getByLabel('服务端诊断日志')).toHaveText('微信测试诊断')
  await page.getByRole('dialog').getByRole('button', { name: '刷新', exact: true }).click()
  await expect(page.getByRole('dialog').getByLabel('服务端诊断日志')).toHaveText('微信测试诊断')
  responses.setFailure(true)
  await page.getByRole('dialog').getByRole('button', { name: '刷新', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('无法读取服务端诊断日志')
  responses.setFailure(false)
  responses.setLogs({ text: '读取已恢复', truncated: false })
  await page.clock.fastForward(5_100)
  await expect(page.getByRole('dialog').getByLabel('服务端诊断日志')).toHaveText('读取已恢复')
}

async function navigateWithinSpa(page: Page, path: string) {
  await page.evaluate((pathname) => {
    history.pushState({}, '', pathname)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}
