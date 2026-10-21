import { expect, test } from '../../fixtures/web.fixture'

test('开发环境的 404 预览展示错误路径和返回操作', async ({ page }) => {
  await page.goto('/__dev/404-preview')

  await expect(page.getByRole('heading', { name: '页面暂时找不到' })).toBeVisible()
  await expect(page.getByText('/__dev/404-preview', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '返回首页' })).toBeVisible()
  await expect(page.getByRole('button', { name: '返回上一页' })).toBeVisible()
  await expect(page.locator('main > div > div').first()).toHaveCSS('background-image', /linear-gradient/)
})
