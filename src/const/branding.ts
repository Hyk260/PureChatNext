export const BRANDING_NAME = 'PureChat';
export const BRANDING_LOGO_URL = '';

export const BRANDING_URL = {
  help: undefined,
  privacy: undefined,
  terms: undefined,
};

export const PROXY_CONFIG = {
  /**
   * backendApiEndpoints
   */
  BACKEND_ENDPOINTS: ["/api"],
  /**
   * 需要鉴权的路由
   */
  PROTECTED_ROUTES: [
    "/api/rest-api",
    "/api/chat"
  ],
  PING_PATH: "/ping",
  USER_HEADERS: {
    ID: "x-user-id",
    ROLE: "x-user-role"
  },
  CORS_ALLOWED_ORIGINS: "*", // 可根据需要配置具体的允许域名
};

// securehity-headers
export const SECURITY_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block"
}

export const SOCIAL_URL = {
  github: 'https://github.com/Hyk260/PureChat',
};

export const BRANDING_EMAIL = {
  business: '',
  support: '',
};
