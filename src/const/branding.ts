export const BRANDING_NAME = 'PureChat'
export const BRANDING_LOGO_URL = ''

export const BRANDING_URL = {
  help: '/help',
  privacy: '/privacy',
  terms: '/terms',
}

export const PROXY_CONFIG = {
  /**
   * backendApiEndpoints
   */
  BACKEND_ENDPOINTS: ['/api'],
  /**
   * 需要鉴权的路由
   */
  PROTECTED_ROUTES: ['/api/rest-api'],
  PING_PATH: '/ping',
  USER_HEADERS: {
    ID: 'x-user-id',
    ROLE: 'x-user-role',
  },
}

// securehity-headers
export const SECURITY_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
}

export const SOCIAL_URL = {
  github: 'https://github.com/Hyk260/PureChatNext',
}

export const BRANDING_EMAIL = {
  business: '',
  support: '',
}
