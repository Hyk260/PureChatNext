import {
  adminClient,
  emailOTPClient,
  genericOAuthClient,
  inferAdditionalFields,
  magicLinkClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import type { auth } from '@/auth'

const isDesktopRenderer = () =>
  typeof window !== 'undefined' && window.location.protocol === 'purechat:'

/**
 * Better Auth only accepts HTTP(S) base URLs, while packaged Electron uses
 * `purechat://renderer` as its document origin. Keep the client base URL
 * valid, then send the request back through Electron's same-origin proxy.
 */
const desktopFetch: typeof fetch = (input, init) => {
  if (!isDesktopRenderer()) return fetch(input, init)

  const inputUrl = typeof input === 'string' || input instanceof URL ? input.toString() : input.url
  const targetUrl = new URL(inputUrl)
  targetUrl.protocol = 'purechat:'
  targetUrl.hostname = 'renderer'
  targetUrl.port = ''

  if (input instanceof Request) return fetch(new Request(targetUrl, input), init)
  return fetch(targetUrl, init)
}

export const {
  changeEmail,
  changePassword,
  emailOtp,
  linkSocial,
  oauth2,
  accountInfo,
  listAccounts,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
  signIn,
  signOut,
  signUp,
  unlinkAccount,
  updateUser,
  useSession,
} = createAuthClient({
  baseURL: isDesktopRenderer() ? 'http://localhost/api/auth' : undefined,
  fetchOptions: {
    customFetchImpl: desktopFetch,
  },
  plugins: [
    adminClient(),
    inferAdditionalFields<typeof auth>(),
    genericOAuthClient(),
    emailOTPClient(),
    // Always include magicLinkClient - server will reject if not enabled
    magicLinkClient(),
  ],
})
