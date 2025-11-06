import { NextRequest, NextResponse } from 'next/server';
import { appEnv } from '@/envs/app';

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
  .map((s) => s.trim())
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

