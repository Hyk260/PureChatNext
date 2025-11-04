import { type NextRequest, NextResponse } from "next/server";
import debug from "debug";
// import { getToken } from "next-auth/jwt";
import { isDev } from "./libs/constants";

const backendApiEndpoints = ["/api", "/trpc", "/webapi", "/oidc"];

const logDefault = debug("proxy:default");

// 开发环境下启用所有调试日志
if (isDev) {
  debug.enabled("proxy:*");
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  logDefault('Processing request: %s %s', request.method, request.url);
  
  // 详细的请求信息（开发环境）
  if (isDev && false) {
    console.log('\n========== Proxy Debug Info ==========');
    console.log('📋 Request Method:', request.method);
    console.log('🔗 Full URL:', request.url);
    console.log('📍 Pathname:', pathname);
    console.log('🔍 Query Params:', Object.fromEntries(searchParams));
    console.log('🌐 Origin:', request.nextUrl.origin);
    console.log('🔐 Protocol:', request.nextUrl.protocol);
    console.log('======================================\n');
  }

  /*
   * Playwright 启动开发服务器，并要求返回 200 状态码才能开始测试，因此这能确保测试可以启动
   */
  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  // 跳过所有API请求
  if (backendApiEndpoints.some((path) => pathname.startsWith(path))) {
    logDefault('Skipping API request: %s', pathname);
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/api/:path*",
    "/login",

    /*
     * 匹配所有请求路径，除了以下路径：
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico, sitemap.xml, robots.txt (元数据文件)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

