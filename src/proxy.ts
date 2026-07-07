import { type NextRequest, NextResponse } from 'next/server'
import {
  createCorsPreflightResponse,
  handleProtectedRoute,
  isBackendApiPath,
  isProtectedRoute,
  withCors,
} from '@/libs/utils/cors'

const testEndpoints = ['/dev', '/api/dev']

async function handleApiRequest(request: NextRequest, pathname: string) {
  if (request.method === 'OPTIONS') {
    return createCorsPreflightResponse(request)
  }

  if (isProtectedRoute(pathname)) {
    return handleProtectedRoute(request, pathname)
  }

  return withCors(request, NextResponse.next())
}

export async function proxy(request: NextRequest) {
  const isProd = process.env.NODE_ENV === 'production'
  const { pathname } = request.nextUrl

  // 生产环境禁止访问开发页面与开发 API
  if (isProd && testEndpoints.some((path) => pathname.startsWith(path))) {
    return new NextResponse('dev only', { status: 404 })
  }

  if (isBackendApiPath(pathname)) {
    return handleApiRequest(request, pathname)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api(.*)',
    // include the /
    '/',
    '/login',

    '/me',
    '/me(.*)',
    '/share(.*)',

    '/signup(.*)',
    '/signin(.*)',
    '/dev(.*)',
    '/verify-email(.*)',
    // '/verify-im(.*)',
    '/reset-password(.*)',
    '/auth-error(.*)',
    '/oauth(.*)',

    /*
     * 匹配所有请求路径，除了以下路径：
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico, sitemap.xml, robots.txt (元数据文件)
     */
    // '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
