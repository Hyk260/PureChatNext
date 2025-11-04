import { NextRequest, NextResponse } from 'next/server';

/**
 * CORS 配置
 */
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:8038'
];

const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
const allowedHeaders = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
];

/**
 * CORS 中间件
 */
export function corsMiddleware(
  request: NextRequest,
  response?: NextResponse
) {
  const origin = request.headers.get('origin');

  // 创建响应对象（如果没有提供）
  const corsResponse = response || new NextResponse();

  // 设置允许的源
  if (origin && allowedOrigins.includes(origin)) {
    corsResponse.headers.set('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.includes('*')) {
    corsResponse.headers.set('Access-Control-Allow-Origin', '*');
  } else if (origin) {
    // 如果请求有 origin 但不匹配，仍允许（开发环境）
    corsResponse.headers.set('Access-Control-Allow-Origin', origin);
  }

  // 设置允许的方法
  corsResponse.headers.set(
    'Access-Control-Allow-Methods',
    allowedMethods.join(', ')
  );

  // 设置允许的头部
  corsResponse.headers.set(
    'Access-Control-Allow-Headers',
    allowedHeaders.join(', ')
  );

  // 允许携带凭证
  corsResponse.headers.set('Access-Control-Allow-Credentials', 'true');

  // 预检请求处理
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: corsResponse.headers,
    });
  }

  return corsResponse;
}

