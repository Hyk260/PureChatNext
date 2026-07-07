import debug from 'debug'
import { type NextRequest, NextResponse } from 'next/server'
import { appEnv } from '@/envs/app'
import { verifyAuth } from '@/libs/auth/middleware'

import { PROXY_CONFIG } from '@/const/branding'

// 允许的跨域源：默认基础域 + 环境变量扩展
const defaultAllowedOrigins = [
  appEnv.APP_URL,
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:8080',
  'http://localhost:8038',
].filter(Boolean) as string[]

const extraAllowedOrigins = (appEnv.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean)

export const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...extraAllowedOrigins]))
const allowedOriginSet = new Set(allowedOrigins)

/**
 * CORS 配置
 */
const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
const allowedHeaders = ['Content-Type', 'Authorization', 'X-Requested-With']

const protectedRoutes = [...PROXY_CONFIG.PROTECTED_ROUTES]

const log = debug('cors:default')

function resolveAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null
  if (allowedOriginSet.has(origin)) return origin
  if (process.env.NODE_ENV === 'development') return origin
  return null
}

/**
 * 判断是否为需要 CORS 处理的后端 API 路径
 */
export function isBackendApiPath(pathname: string): boolean {
  return PROXY_CONFIG.BACKEND_ENDPOINTS.some((path) => pathname.startsWith(path))
}

/**
 * 添加 CORS 头部到响应（仅在 Origin 被允许时设置）
 */
export function addCorsHeaders(request: NextRequest, headers: Headers, options?: { preflight?: boolean }): void {
  const allowedOrigin = resolveAllowedOrigin(request.headers.get('origin'))
  if (!allowedOrigin) return

  headers.set('Access-Control-Allow-Origin', allowedOrigin)
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set('Vary', 'Origin')
  headers.set('Access-Control-Allow-Methods', allowedMethods.join(', '))
  headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '))

  if (options?.preflight) {
    headers.set('Access-Control-Max-Age', '86400')
  }
}

/**
 * 为响应附加 CORS 头并返回
 */
export function withCors(request: NextRequest, response: NextResponse): NextResponse {
  addCorsHeaders(request, response.headers)
  return response
}

/**
 * 创建 CORS 预检响应
 */
export function createCorsPreflightResponse(request: NextRequest): NextResponse {
  const response = new NextResponse(null, { status: 204 })
  addCorsHeaders(request, response.headers, { preflight: true })
  return response
}

/**
 * 检查路径是否需要JWT验证
 */
export function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some((route) => {
    if (route.endsWith('*')) {
      return pathname.startsWith(route.slice(0, -1))
    }
    return pathname === route || pathname.startsWith(route + '/')
  })
}

/**
 * 处理受保护路由的JWT验证
 */
export async function handleProtectedRoute(request: NextRequest, pathname: string): Promise<NextResponse> {
  const { user, error } = await verifyAuth(request)

  if (!user) {
    log(`Unauthorized access attempt to ${pathname}: ${error}`)
    return withCors(
      request,
      NextResponse.json(
        {
          success: false,
          error: error || 'Unauthorized',
          message: '请提供有效的 Bearer token',
        },
        { status: 401 }
      )
    )
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(PROXY_CONFIG.USER_HEADERS.ID, user.userId)
  if (user.role) {
    requestHeaders.set(PROXY_CONFIG.USER_HEADERS.ROLE, user.role)
  }

  log(`User ${user.userId} authenticated for ${pathname}`)

  return withCors(
    request,
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  )
}
