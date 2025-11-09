export const BRANDING_NAME = 'PureChat';
export const BRANDING_LOGO_URL = '';

export const BRANDING_URL = {
  help: undefined,
  privacy: undefined,
  terms: undefined,
};

export const PROXY_CONFIG = {
  BACKEND_ENDPOINTS: ["/api"],
  PROTECTED_ROUTES: ["/api/rest-api"],
  PING_PATH: "/ping",
  USER_HEADERS: {
    ID: "x-user-id",
    ROLE: "x-user-role"
  },
  CORS_ALLOWED_ORIGINS: "*", // 可根据需要配置具体的允许域名
};

export const SOCIAL_URL = {
  github: 'https://github.com/Hyk260/PureChat',
};

export const BRANDING_EMAIL = {
  business: '',
  support: '',
};
