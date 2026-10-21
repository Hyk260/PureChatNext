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

test('登录步骤切换后按回车提交密码', async ({ page }) => {
  let signInPayload: Record<string, unknown> | undefined
  let signInRequestCount = 0

  await page.addInitScript(() => {
    sessionStorage.setItem('purechat:auth:agreement', '1')
  })
  await page.route('**/api/auth/check-user', (route) =>
    route.fulfill({
      json: {
        email: 'member@example.com',
        emailVerified: true,
        exists: true,
        hasPassword: true,
      },
    })
  )
  await page.route('**/api/auth/sign-in/email', async (route) => {
    signInRequestCount += 1
    signInPayload = route.request().postDataJSON()
    await route.fulfill({
      status: 401,
      json: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' },
    })
  })

  await page.goto('/signin')
  await page.getByPlaceholder('请输入邮箱或用户名').fill('member@example.com')
  await page.getByRole('button', { name: '下一步' }).click()
  await expect(page.getByPlaceholder('请输入密码')).toBeVisible()

  const password = page.getByPlaceholder('请输入密码')
  await password.fill('wrong-password')
  await password.press('Enter')

  await expect
    .poll(() => signInPayload)
    .toMatchObject({
      email: 'member@example.com',
      password: 'wrong-password',
    })
  await expect.poll(() => signInRequestCount).toBe(1)
  await expect(page.getByText('账号或密码错误').first()).toBeVisible()
})

test('创建账号链接保留回调地址并打开注册表单', async ({ page }) => {
  await page.goto('/signin?callbackUrl=%2Fchat%3Ftopic%3Dsmoke')
  await page.getByRole('link', { name: '创建账号', exact: true }).click()

  await expect(page).toHaveURL(
    (url) => url.pathname === '/signup' && url.searchParams.get('callbackUrl') === '/chat?topic=smoke'
  )
  await expect(page.getByPlaceholder('请输入邮箱地址', { exact: true })).toBeVisible()
})

test('注册表单不显示必填星号并保留协议行间距', async ({ page }) => {
  await page.goto('/signup')

  await expect(page.locator('input[required]')).toHaveCount(0)

  const confirmPasswordBox = await page.getByPlaceholder('请确认密码').boundingBox()
  const agreementBox = await page.getByText('我已阅读并同意', { exact: false }).first().boundingBox()
  const submitBox = await page.getByRole('button', { name: '注册' }).boundingBox()

  if (!confirmPasswordBox || !agreementBox || !submitBox) throw new Error('注册表单布局未能读取')

  expect(agreementBox.y - (confirmPasswordBox.y + confirmPasswordBox.height)).toBeGreaterThanOrEqual(12)
  expect(submitBox.y - (agreementBox.y + agreementBox.height)).toBeGreaterThanOrEqual(12)
})

test('注册确认密码不一致时由 Lobe 表单校验阻止请求', async ({ page }) => {
  const authRequests: string[] = []
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname
    if (pathname === '/api/auth/check-user' || pathname === '/api/auth/sign-up/email') {
      authRequests.push(pathname)
    }
  })

  await page.goto('/signup')
  await page.getByPlaceholder('请输入邮箱地址').fill('new@example.com')
  await page.getByPlaceholder('请输入密码').fill('Strong123')
  await page.getByPlaceholder('请确认密码').fill('Other123')
  await page.getByRole('button', { name: '注册' }).click()

  await expect(page.getByText('两次输入的密码不一致')).toBeVisible()
  expect(authRequests).toEqual([])
})
