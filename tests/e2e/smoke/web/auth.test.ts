import { expect, test } from '../../fixtures/web.fixture'

test('匿名访问聊天保留回调地址并跳转登录', async ({ page }) => {
  await page.goto('/chat?topic=smoke')

  await expect(page).toHaveURL(
    (url) => url.pathname === '/signin' && url.searchParams.get('callbackUrl') === '/chat?topic=smoke'
  )
  await expect(page.getByPlaceholder('请输入邮箱或用户名')).toBeVisible()
})

test('无效登录标识在客户端校验失败', async ({ page }) => {
  const accountRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/auth/check-user') accountRequests.push(request.url())
  })
  await page.goto('/signin')
  await page.getByPlaceholder('请输入邮箱或用户名').fill('invalid@')
  await page.getByRole('button', { name: '下一步' }).click()

  await expect(page.getByText('请输入有效的邮箱地址', { exact: true })).toBeVisible()
  expect(accountRequests).toEqual([])
})

test('创建账号链接保留回调地址并打开注册表单', async ({ page }) => {
  await page.goto('/signin?callbackUrl=%2Fchat%3Ftopic%3Dsmoke')
  await page.getByRole('link', { name: '创建账号', exact: true }).click()

  await expect(page).toHaveURL(
    (url) => url.pathname === '/signup' && url.searchParams.get('callbackUrl') === '/chat?topic=smoke'
  )
  await expect(page.getByPlaceholder('请输入邮箱地址', { exact: true })).toBeVisible()
})
