import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { guestRegex, isDevelopmentEnvironment } from "./lib/constants";
import debug from "debug";

const backendApiEndpoints = ["/api", "/trpc", "/webapi", "/oidc"];

// 创建调试日志记录器实例
const logDefault = debug("proxy:default");
const logRequest = debug("proxy:request");
const logToken = debug("proxy:token");

// 开发环境下启用所有调试日志
if (isDevelopmentEnvironment) {
  debug.enabled("proxy:*");
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  logDefault('Processing request: %s %s', request.method, request.url);
  
  // 详细的请求信息（开发环境）
  if (isDevelopmentEnvironment) {
    console.log('\n========== Proxy Debug Info ==========');
    console.log('📋 Request Method:', request.method);
    console.log('🔗 Full URL:', request.url);
    console.log('📍 Pathname:', pathname);
    console.log('🔍 Query Params:', Object.fromEntries(searchParams));
    console.log('🌐 Origin:', request.nextUrl.origin);
    console.log('🔐 Protocol:', request.nextUrl.protocol);
    
    // 请求头信息
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    // console.log('📦 Headers:', JSON.stringify(headers, null, 2));
    
    // Cookie 信息
    const cookies: Record<string, string> = {};
    request.cookies.getAll().forEach((cookie) => {
      cookies[cookie.name] = cookie.value;
    });
    // console.log('🍪 Cookies:', JSON.stringify(cookies, null, 2));
    
    logRequest('Request details: %O', {
      method: request.method,
      pathname,
      searchParams: Object.fromEntries(searchParams),
      headers: headers,
      cookies: cookies,
    });
  }

  /*
   * Playwright 启动开发服务器，并要求返回 200 状态码才能开始测试，因此这能确保测试可以启动
   */
  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  // if (pathname.startsWith("/api/auth")) {
  //   return NextResponse.next();
  // }

  // 跳过所有API请求
  if (backendApiEndpoints.some((path) => pathname.startsWith(path))) {
    logDefault('Skipping API request: %s', pathname);
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  // Token 调试信息
  if (isDevelopmentEnvironment) {
    console.log('🎫 Token:', token ? {
      email: token.email,
      name: token.name,
      sub: token.sub,
      exp: token.exp && typeof token.exp === 'number' ? new Date(token.exp * 1000).toISOString() : null,
      iat: token.iat && typeof token.iat === 'number' ? new Date(token.iat * 1000).toISOString() : null,
      // 不打印完整 token 对象，避免敏感信息
    } : 'null (未登录)');
    
    logToken('Token details: %O', {
      hasToken: !!token,
      email: token?.email,
      isGuest: token?.email ? guestRegex.test(token.email) : false,
    });
  }

  // if (!token) {
  //   const redirectUrl = encodeURIComponent(request.url);

  //   return NextResponse.redirect(
  //     new URL(`/api/auth/guest?redirectUrl=${redirectUrl}`, request.url)
  //   );
  // }

  const isGuest = guestRegex.test(token?.email ?? "");

  if (isDevelopmentEnvironment) {
    console.log('👤 User Type:', isGuest ? 'Guest' : token ? 'Authenticated' : 'Anonymous');
    console.log('🔄 Will redirect:', token && !isGuest && ["/login", "/register"].includes(pathname) ? 'Yes -> /' : 'No');
    console.log('========== End Proxy Debug ==========\n');
  }

  if (token && !isGuest && ["/login", "/register"].includes(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/api/:path*",
    "/api/rest-api",
    "/login",
    "/register",

    /*
     * 匹配所有请求路径，除了以下路径：
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico, sitemap.xml, robots.txt (元数据文件)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

