/**
 * API 客户端工具函数
 * 用于前端调用后端 API
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * 获取存储的 access token
 */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

/**
 * 获取存储的 refresh token
 */
function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refresh_token');
}

/**
 * 保存 tokens
 */
export function saveTokens(accessToken: string, refreshToken: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
}

/**
 * 清除 tokens
 */
export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

/**
 * 刷新 token
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      return null;
    }

    const data = await response.json();
    saveTokens(data.session.access_token, data.session.refresh_token);
    return data.session.access_token;
  } catch (error) {
    clearTokens();
    return null;
  }
}

/**
 * 通用 API 请求函数
 */
export async function apiRequest<T = string>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    // headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(url, {
    ...options,
    headers,
  });

  // 如果 token 过期，尝试刷新
  if (response.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, {
        ...options,
        headers,
      });
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: '请求失败',
    }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * 登录
 */
export async function login(email: string, password: string) {
  const data = await apiRequest<{
    message: string;
    user: string;
    session: {
      access_token: string;
      refresh_token: string;
      expires_at: number;
    };
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  saveTokens(data.session.access_token, data.session.refresh_token);
  return data;
}

/**
 * 注册
 */
export async function register(email: string, password: string) {
  const data = await apiRequest<{
    message: string;
    user: string;
    session: {
      access_token: string;
      refresh_token: string;
      expires_at: number;
    } | null;
  }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (data.session) {
    saveTokens(data.session.access_token, data.session.refresh_token);
  }
  return data;
}

/**
 * 登出
 */
export async function logout() {
  try {
    await apiRequest('/api/auth/logout', {
      method: 'POST',
    });
  } finally {
    clearTokens();
  }
}

/**
 * 获取当前用户
 */
export async function getCurrentUser() {
  return apiRequest<{ user: string }>('/api/auth/me', {
    method: 'GET',
  });
}

