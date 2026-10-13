import { test as base } from '@playwright/test'

const authConfig = {
  emailVerificationMode: 'otp',
  enableEmailVerification: false,
  enableMagicLink: false,
  oAuthSSOProviders: [],
}

export const test = base.extend({
  page: async ({ page, baseURL }, run) => {
    if (!baseURL) throw new Error('Web project requires a baseURL')
    const origin = new URL(baseURL).origin
    await page.route('**/*', async (route) => {
      const { origin: requestOrigin, pathname } = new URL(route.request().url())
      if (requestOrigin !== origin) {
        // External fonts/assets must not make an isolated smoke test depend on a CDN.
        await route.abort('blockedbyclient')
        return
      }
      if (pathname === '/api/auth/config') {
        await route.fulfill({ json: authConfig })
      } else if (pathname === '/api/auth/get-session') {
        await route.fulfill({ json: null })
      } else if (pathname.startsWith('/api/')) {
        // Never let a smoke test reach the Vite proxy and mutate a real BFF.
        await route.abort('blockedbyclient')
      } else {
        await route.continue()
      }
    })
    await run(page)
  },
})

export { expect } from '@playwright/test'
