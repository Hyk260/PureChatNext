import debug from 'debug'
import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { appEnv } from '@/envs/app';
import { verifyAuth } from '@/libs/auth/middleware'

import { PROXY_CONFIG } from '@/const/branding'

// 允许的跨域源：默认基础域 + 环境变量扩展
const defaultAllowedOrigins = [
  appEnv.APP_URL,
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:8080',
  'http://localhost:8038',
].filter(Boolean) as string[];

const extraAllowedOrigins = (appEnv.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);

export const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...extraAllowedOrigins]));

/**
 * CORS 配置
 */
const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
const allowedHeaders = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
];

const protectedRoutes = [
  ...PROXY_CONFIG.PROTECTED_ROUTES,
  // "/api/rest-api",
  // "/api/chat",
]

const logDefault = debug('cors:default')

/**
 * 添加 CORS 头部到响应
 */
export function addCorsHeaders(request: NextRequest, headers: Headers): void {
  const origin = request.headers.get("origin")

  // 设置允许的源
  if (origin && allowedOrigins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin)
  } else if (allowedOrigins.includes("*")) {
    headers.set("Access-Control-Allow-Origin", "*")
  } else if (origin && process.env.NODE_ENV === "development") {
    // 开发环境允许所有源
    headers.set("Access-Control-Allow-Origin", origin)
  }

  // 设置允许的方法
  headers.set("Access-Control-Allow-Methods", allowedMethods.join(", "))

  // 设置允许的头部
  headers.set("Access-Control-Allow-Headers", allowedHeaders.join(", "))

  // 允许携带凭证
  headers.set("Access-Control-Allow-Credentials", "true")

  // 设置预检请求缓存时间（24小时）
  headers.set("Access-Control-Max-Age", "86400")
}

/**
 * 创建 CORS 预检响应
 */
export function createCorsPreflightResponse(request: NextRequest): NextResponse {
  const response = new NextResponse(null, { status: 204 })
  addCorsHeaders(request, response.headers)
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
 * @param request - 请求对象
 * @param pathname - 请求路径
 * @returns 包含用户信息的响应或未授权响应
 */
export async function handleProtectedRoute(request: NextRequest, pathname: string): Promise<NextResponse> {
  const { user, error } = await verifyAuth(request)

  if (!user) {
    logDefault(`Unauthorized access attempt to ${pathname}: ${error}`)
    const response = NextResponse.json(
      {
        success: false,
        error: error || 'Unauthorized',
        message: '请提供有效的 Bearer token',
      },
      { status: 401 }
    )
    addCorsHeaders(request, response.headers)
    return response
  }

  // 将用户信息附加到请求头中，供后续路由使用
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id', user.userId)
  if (user.role) {
    requestHeaders.set('x-user-role', user.role)
  }

  logDefault(`User ${user.userId} authenticated for ${pathname}`)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  addCorsHeaders(request, response.headers)
  return response
}

