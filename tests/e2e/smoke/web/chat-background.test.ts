import { createServer } from 'node:http'
import type { ServerResponse } from 'node:http'

import { test, expect } from '@playwright/test'
import type { UIMessage } from 'ai'

const agent = {
  id: 'agt_background',
  slug: 'background',
  title: '后台生成测试',
  avatar: '🤖',
  systemRole: 'Test assistant',
  isBuiltin: false,
}
const makeTopic = (id: string, title: string) => ({
  id,
  title,
  agentId: agent.id,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  favorite: false,
  permissionMode: 'auto',
  projectName: null,
})

test('switches and leaves chat while parallel generations keep streaming and saving', async ({ page, baseURL }) => {
  const responses = new Map<string, ServerResponse>()
  const saved = new Map<string, UIMessage[]>()
  const gets = new Map<string, number>()
  const requests: string[] = []
  const topics = [makeTopic('background-a', '后台话题 A'), makeTopic('background-b', '后台话题 B')]
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    response.setHeader('Access-Control-Allow-Origin', baseURL ?? 'http://localhost:5174')
    response.setHeader('Access-Control-Allow-Credentials', 'true')
    const json = (value: unknown) => {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(value))
    }
    const buffers: Uint8Array[] = []
    for await (const chunk of request) buffers.push(chunk)
    const body = buffers.length ? JSON.parse(Buffer.concat(buffers).toString()) : undefined
    if (path === '/api/auth/get-session') {
      json({
        user: {
          id: 'background-user',
          name: 'Test',
          email: 'test@example.com',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          id: 'background-session',
          userId: 'background-user',
          token: 'test-only',
          expiresAt: new Date(Date.now() + 3_600_000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
    } else if (path === '/api/auth/config') {
      json({ enableEmailVerification: false, enableMagicLink: false, oAuthSSOProviders: [] })
    } else if (path === '/api/agents') json([agent])
    else if (path === `/api/agents/${agent.id}`) json(agent)
    else if (path === '/api/chat/topics') json(topics)
    else if (path.endsWith('/messages')) {
      const id = path.split('/').at(-2)!
      if (request.method === 'PUT') {
        saved.set(id, body.messages)
        json({ success: true })
      } else {
        gets.set(id, (gets.get(id) ?? 0) + 1)
        json([]) // Deliberately stale: a live runtime must take precedence.
      }
    } else if (path === '/api/chat') {
      requests.push(body.topicId)
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'x-vercel-ai-ui-message-stream': 'v1',
      })
      responses.set(body.topicId, response)
      response.write(`data: ${JSON.stringify({ type: 'start', messageId: `reply-${body.topicId}` })}\n\n`)
      response.write(`data: ${JSON.stringify({ type: 'start-step' })}\n\n`)
      response.write(`data: ${JSON.stringify({ type: 'text-start', id: 'text' })}\n\n`)
    } else if (path === '/api/providers/config') json({})
    else if (path === '/api/providers/secrets') json({})
    else json([])
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing fixture port')
  const upstream = `http://127.0.0.1:${address.port}`
  const send = (id: string, delta: string, finish = false) => {
    const response = responses.get(id)
    if (!response) throw new Error(`No stream for ${id}`)
    response.write(`data: ${JSON.stringify({ type: 'text-delta', id: 'text', delta })}\n\n`)
    if (finish) {
      response.write(`data: ${JSON.stringify({ type: 'text-end', id: 'text' })}\n\n`)
      response.write(`data: ${JSON.stringify({ type: 'finish-step' })}\n\n`)
      response.write(`data: ${JSON.stringify({ type: 'finish', finishReason: 'stop' })}\n\ndata: [DONE]\n\n`)
      response.end()
    }
  }
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    await route.continue({ url: `${upstream}${url.pathname}${url.search}` })
  })
  try {
    await page.goto(`/chat?agent=${agent.id}&topic=background-a`)
    await page.getByPlaceholder('随心输入').fill('开始 A')
    await page.getByTitle('发送', { exact: true }).click()
    await expect.poll(() => responses.has('background-a')).toBe(true)
    const initialAGets = gets.get('background-a')
    send('background-a', 'A 正在生成')
    await expect(page.getByLabel('正在生成', { exact: true })).toHaveCount(1)
    await page.getByTitle('后台话题 B', { exact: true }).click()
    await expect(page).toHaveURL(/topic=background-b/)
    await expect(page.getByTitle('停止', { exact: true })).toHaveCount(0)
    await page.getByPlaceholder('随心输入').fill('开始 B')
    await page.getByTitle('发送', { exact: true }).click()
    await expect.poll(() => responses.has('background-b')).toBe(true)
    const initialBGets = gets.get('background-b')
    await expect(page.getByLabel('正在生成', { exact: true })).toHaveCount(2)
    send('background-a', '，切换后继续')
    send('background-b', 'B 独立生成')
    await page.getByTitle('后台话题 A', { exact: true }).click()
    await expect(page.getByText('A 正在生成，切换后继续', { exact: true })).toBeVisible()
    expect(gets.get('background-a')).toBe(initialAGets)
    await page.getByTitle('停止', { exact: true }).click()
    await expect(page.getByLabel('正在生成', { exact: true })).toHaveCount(1)
    await page.getByTitle('后台话题 B', { exact: true }).click()
    await expect(page.getByText('B 独立生成', { exact: true })).toBeVisible()
    // Browser history performs SPA navigation; the global runtime survives route unmount.
    await page.getByRole('button').first().click()
    await expect(page).toHaveURL(/\/$/)
    send('background-b', '，离开页面后完成', true)
    await expect.poll(() => JSON.stringify(saved.get('background-b'))).toContain('离开页面后完成')
    await page.goBack()
    await expect(page.getByText('B 独立生成，离开页面后完成', { exact: true })).toBeVisible()
    await expect(page.getByLabel('正在生成', { exact: true })).toHaveCount(0)
    expect(gets.get('background-b')).toBe(initialBGets)
    expect(requests).toEqual(['background-a', 'background-b'])
    expect(errors).toEqual([])
  } finally {
    for (const response of responses.values()) response.destroy()
    server.closeAllConnections()
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  }
})
