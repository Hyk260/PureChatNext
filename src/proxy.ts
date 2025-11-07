import { type NextRequest, NextResponse } from "next/server";
import debug from "debug";
import { ipAddress } from '@vercel/functions';
import { addCorsHeaders, createCorsPreflightResponse } from "@/libs/utils/cors";
// import { getToken } from "next-auth/jwt";
import { logger } from '@/libs/logger';
import { isDev } from "./libs/constants";

const backendApiEndpoints = ["/api"];

const logDefault = debug("proxy:default");

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // const ip = ipAddress(request)

  // logger.info(`clientIp: ${ip}`)

  logDefault("Processing request: %s %s", request.method, request.url);

  if (isDev) {
    console.log("\n========== Proxy Debug Info ==========");
    console.log("📋 Request Method:", request.method);
    console.log("🔗 Full URL:", request.url);
    console.log("📍 Pathname:", pathname);
    console.log("🔍 Query Params:", Object.fromEntries(searchParams));
    console.log("🌐 Origin:", request.nextUrl.origin);
    console.log("🔐 Protocol:", request.nextUrl.protocol);
    console.log("======================================\n");
  }

  /*
   * Playwright 启动开发服务器，并要求返回 200 状态码才能开始测试，因此这能确保测试可以启动
   */
  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  if (backendApiEndpoints.some((path) => pathname.startsWith(path))) {
    logDefault("Processing API request with CORS: %s", pathname);

    // 处理 OPTIONS 预检请求
    if (request.method === "OPTIONS") {
      return createCorsPreflightResponse(request);
    }

    const response = NextResponse.next();
    addCorsHeaders(request, response.headers);
    return response;
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
