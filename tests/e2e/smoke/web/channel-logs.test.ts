import { createChannelResponses, verifyChannelDialog } from '../../fixtures/channel-logs'
import { test } from '../../fixtures/web.fixture'

test('QQ 和微信日志入口、空记录、刷新暂停、错误重试和平台隔离', async ({ page, baseURL }) => {
  const responses = createChannelResponses()
  await page.route('**/api/**', async (route) => {
    const result = responses.respond(new URL(route.request().url()).pathname)
    await route.fulfill({ status: result.status, json: result.body })
  })
  await verifyChannelDialog(page, responses, baseURL!)
})
