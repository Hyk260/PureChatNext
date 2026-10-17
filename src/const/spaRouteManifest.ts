import { matchRoutes } from 'react-router'
import type { RouteObject } from 'react-router'

/** Full route patterns used to distinguish real SPA pages from the router fallback. */
const SPA_ROUTE_PATTERNS = [
  '/',
  '/chat',
  '/resources',
  '/resources/library/:id',
  '/resources/library/:id/*',
  '/accept-referral',
  '/signin',
  '/signup',
  '/verify-email',
  '/reset-password',
  '/auth-error',
  '/desktop-authorize',
  '/profile',
  '/help',
  '/privacy',
  '/terms',
  '/share/t/:id',
  '/settings',
  '/settings/profile',
  '/settings/credits',
  '/settings/usage',
  '/settings/about',
  '/settings/system-tools',
  '/settings/data',
  '/settings/users',
  '/settings/web-search',
  '/settings/web-search-console',
  '/settings/email-service',
  '/settings/read-file',
  '/settings/s3',
  '/settings/qq-conversation',
  '/settings/wechat-conversation',
  '/settings/messenger/:platform?',
  '/settings/skill',
  '/settings/appearance',
  '/settings/language',
  '/settings/hotkey',
  '/settings/notification',
  '/settings/stats',
  '/settings/advanced',
  '/settings/storage',
  '/settings/memory',
  '/settings/creds',
  '/settings/connector',
  '/settings/service-model',
  '/settings/provider',
  '/settings/provider/all',
  '/settings/provider/:id',
  '/community',
  '/community/agent',
  '/community/model',
  '/community/skill',
  '/community/provider',
  '/admin/users',
  '/admin/email-service',
  '/admin/read-file',
  '/admin/s3',
  '/admin/qq-conversation',
  '/admin/wechat-conversation',
] as const

const DEVELOPMENT_ROUTE_PATTERNS = [
  '/dev/code-block',
  '/dev/approval-card',
  '/dev/context-window',
  '/dev/accept-referral',
  '/dev/desktop-login',
  '/dev/desktop-authorize',
] as const

const PRODUCTION_ROUTES: RouteObject[] = SPA_ROUTE_PATTERNS.map((path) => ({ path }))
const DEVELOPMENT_ROUTES: RouteObject[] = DEVELOPMENT_ROUTE_PATTERNS.map((path) => ({ path }))

export function isKnownSpaRoute(pathname: string, includeDevelopmentRoutes = process.env.NODE_ENV !== 'production') {
  const routes = includeDevelopmentRoutes ? [...PRODUCTION_ROUTES, ...DEVELOPMENT_ROUTES] : PRODUCTION_ROUTES
  return matchRoutes(routes, pathname) !== null
}
