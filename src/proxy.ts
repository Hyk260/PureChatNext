import { type NextRequest, NextResponse } from 'next/server'
import debug from 'debug'
import { UAParser } from 'ua-parser-js'
import { addCorsHeaders, createCorsPreflightResponse, isProtectedRoute, handleProtectedRoute } from '@/libs/utils/cors'

const backendApiEndpoints = ['/api']

const logDefault = debug('proxy:default')

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // logDefault('Processing request: %s %s', request.method, request.url)

  // const ua = request.headers.get('user-agent')

  // const device = new UAParser(ua || '').getDevice()

  // logDefault('User preferences: %O', {
  //   deviceType: device.type,
  // })

  // 处理API请求
  if (backendApiEndpoints.some((path) => pathname.startsWith(path))) {
    // logDefault('Processing API request with CORS: %s', pathname)

    // 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
      return createCorsPreflightResponse(request)
    }

    // 处理受保护的路由
    if (isProtectedRoute(pathname)) {
      return handleProtectedRoute(request, pathname)
    }

    // 处理普通API请求
    const response = NextResponse.next()
    addCorsHeaders(request, response.headers)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/api/:path*',
    '/login',

    /*
     * 匹配所有请求路径，除了以下路径：
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico, sitemap.xml, robots.txt (元数据文件)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
