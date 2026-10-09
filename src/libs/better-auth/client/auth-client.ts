import {
  adminClient,
  emailOTPClient,
  genericOAuthClient,
  inferAdditionalFields,
  magicLinkClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import type { auth } from '@/auth'
import { getDesktopApi } from '@/types/desktop'
import { isDesktopRenderer, isPackagedDesktopRenderer } from '@/utils/desktopAuth'

import { useDesktopSession } from './desktop-session'

/**
 * Better Auth only accepts HTTP(S) base URLs, while packaged Electron uses
 * `purechat://renderer` as its document origin. Keep the client base URL
 * valid, then send the request back through Electron's same-origin proxy.
 */
const desktopFetch: typeof fetch = (input, init) => {
  if (!isPackagedDesktopRenderer()) return fetch(input, init)

  const inputUrl = typeof input === 'string' || input instanceof URL ? input.toString() : input.url
  const targetUrl = new URL(inputUrl)
  targetUrl.protocol = 'purechat:'
  targetUrl.hostname = 'renderer'
  targetUrl.port = ''

  if (input instanceof Request) return fetch(new Request(targetUrl, input), init)
  return fetch(targetUrl, init)
}

const authClient = createAuthClient({
  baseURL: isPackagedDesktopRenderer() ? 'http://localhost/api/auth' : undefined,
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
  signUp,
  unlinkAccount,
  updateUser,
} = authClient

const betterAuthSignOut = authClient.signOut
const betterAuthUseSession = authClient.useSession
const useResolvedSession = isDesktopRenderer() ? useDesktopSession : betterAuthUseSession

export const signOut = (...args: Parameters<typeof betterAuthSignOut>) => {
  if (!isDesktopRenderer()) return betterAuthSignOut(...args)
  return getDesktopApi()?.auth.logout()
}

export const useSession = () => {
  return useResolvedSession()
}
