import { type NextRequest, NextResponse } from "next/server";
import debug from "debug";
import { verifyAuth } from "@/libs/auth/middleware";
import { ipAddress } from "@vercel/functions";
import { addCorsHeaders, createCorsPreflightResponse } from "@/libs/utils/cors";
// import { getToken } from "next-auth/jwt";
import { logger } from "@/libs/logger";
import { isDev } from "./libs/constants";
import { PROXY_CONFIG } from "./const/branding";

const backendApiEndpoints = ["/api"];

const protectedRoutes = [
  ...PROXY_CONFIG.PROTECTED_ROUTES,
  // "/api/rest-api",
  // "/api/chat",
];

const logDefault = debug("proxy:default");

/**
 * 记录调试信息（开发环境）
 * @param request - 请求对象
 */
function logDebugInfo(request: NextRequest): void {
  if (!isDev) return;

  const startTime = performance.now();

  setTimeout(() => {
    const endTime = performance.now();
    const duration = endTime - startTime;

    console.group("🔍 Proxy Request Debug");
    console.log("📊 Method:", request.method);
    console.log("🌐 URL:", request.url);
    console.log("📍 Path:", request.nextUrl.pathname);
    console.log("🔍 Query:", Object.fromEntries(request.nextUrl.searchParams));
    console.log("🏠 Origin:", request.nextUrl.origin);
    console.log("📜 Protocol:", request.nextUrl.protocol);
    console.log("⏱️ Duration:", `${duration.toFixed(2)}ms`);
    console.log("🔒 Protected:", isProtectedRoute(request.nextUrl.pathname));
    console.groupEnd();
  }, 0);
}

/**
 * 检查路径是否需要JWT验证
 */
function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some((route) => {
    if (route.endsWith("*")) {
      return pathname.startsWith(route.slice(0, -1));
    }
    return pathname === route || pathname.startsWith(route + "/");
  });
}

/**
 * 获取客户端IP地址
 */
function getClientIP(request: NextRequest): string | null {
  try {
    // 如果IP地址辅助工具失败或处于非Vercel环境，则回退到标准头部
    const xForwardedFor = request.headers.get("x-forwarded-for");
    const ip = ipAddress(request) || (xForwardedFor ? xForwardedFor.split(',')[0] : "127.0.0.1");
    return ip ?? "127.0.0.1";
  } catch {
    logger.warn("[Proxy] Failed to get client IP");
    return "127.0.0.1";
  }
}

/**
 * 处理受保护路由的JWT验证
 * @param request - 请求对象
 * @param pathname - 请求路径
 * @returns 包含用户信息的响应或未授权响应
 */
async function handleProtectedRoute(
  request: NextRequest,
  pathname: string
): Promise<NextResponse> {
  const { user, error } = await verifyAuth(request);

  if (!user) {
    logger.warn(`[Proxy Auth] Unauthorized access attempt to ${pathname}: ${error}`);
    const response = NextResponse.json(
      {
        success: false,
        error: error || "Unauthorized",
        message: "请提供有效的 Bearer token",
      },
      { status: 401 }
    );
    addCorsHeaders(request, response.headers);
    return response;
  }

  // 将用户信息附加到请求头中，供后续路由使用
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", user.userId);
  if (user.role) {
    requestHeaders.set("x-user-role", user.role);
  }

  logger.info(`[Proxy Auth] User ${user.userId} authenticated for ${pathname}`);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  addCorsHeaders(request, response.headers);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const clientIP = getClientIP(request);

  if (clientIP) {
    console.info("[Proxy] Request received", {
      method: request.method,
      path: pathname,
      ip: clientIP,
      userAgent: request.headers.get("user-agent")?.substring(0, 100) || "Unknown",
    });
  }

  logDefault("Processing request: %s %s", request.method, request.url);
  logDebugInfo(request);

  /*
   * Playwright 启动开发服务器，并要求返回 200 状态码才能开始测试，因此这能确保测试可以启动
   */
  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  // 处理API请求
  if (backendApiEndpoints.some((path) => pathname.startsWith(path))) {
    logDefault("Processing API request with CORS: %s", pathname);

    // 处理 OPTIONS 预检请求
    if (request.method === "OPTIONS") {
      return createCorsPreflightResponse(request);
    }

    // 处理受保护的路由
    if (isProtectedRoute(pathname)) {
      return handleProtectedRoute(request, pathname);
    }

    // 处理普通API请求
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
