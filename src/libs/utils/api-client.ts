/**
 * API 客户端工具函数
 * 用于前端调用后端 API（相对路径 `/api/...`；`API_BASE_URL` 保持空串，禁止写死 host）
 */
const API_BASE_URL = ''

// ── Token 存储 ──────────────────────────────────────────────

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('refresh_token')
}

export function saveTokens(accessToken: string, refreshToken: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem('access_token', accessToken)
  localStorage.setItem('refresh_token', refreshToken)
}

export function clearTokens() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

// ── Token 刷新 ──────────────────────────────────────────────

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => null)
      if (response.status === 401) clearTokens()
      throw new Error(err?.error || '刷新令牌失败')
    }

    const data = await response.json()
    saveTokens(data.data.accessToken, data.data.refreshToken)
    return data.data.accessToken
  } catch (error) {
    console.warn(error)
    clearTokens()
    return null
  }
}

// ── 通用请求 ────────────────────────────────────────────────

export async function apiRequest<T = string>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken()
  const url = `${API_BASE_URL}${endpoint}`

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    ;(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  let response = await fetch(url, { ...options, headers })

  if (response.status === 401 && token) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      ;(headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`
      response = await fetch(url, { ...options, headers })
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }))
    throw new Error(error.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// ── Auth API ────────────────────────────────────────────────

/** 后端统一响应结构 */
interface ApiResponse<T = unknown> {
  message: string
  code: number
  data: T
}

/** 登录 */
export interface LoginInput {
  email?: string
  userId?: string
  password: string
}

export interface LoginData {
  userId: string
  userSig: string
  accessToken: string
  refreshToken: string
}

export async function login(input: LoginInput) {
  const data = await apiRequest<ApiResponse<LoginData>>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  saveTokens(data.data.accessToken, data.data.refreshToken)
  return data
}

/** 注册 */
export interface RegisterInput {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  userId: string
}

/** 注册账号 */
export async function register(input: RegisterInput) {
  return apiRequest<ApiResponse<RegisterData>>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 登出 */
export async function logout() {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' })
  } finally {
    clearTokens()
  }
}

/** 获取当前用户信息 */
export async function me() {
  try {
    return await apiRequest('/api/auth/me', { method: 'GET' })
  } catch (error) {
    console.warn(error)
    return null
  }
}
