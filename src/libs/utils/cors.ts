import { NextRequest, NextResponse } from 'next/server';

/**
 * CORS 配置
 */
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
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
  response: NextResponse = NextResponse.next()
) {
  const origin = request.headers.get('origin');

  // 设置允许的源
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.includes('*')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }

  // 设置允许的方法
  response.headers.set(
    'Access-Control-Allow-Methods',
    allowedMethods.join(', ')
  );

  // 设置允许的头部
  response.headers.set(
    'Access-Control-Allow-Headers',
    allowedHeaders.join(', ')
  );

  // 允许携带凭证
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  // 预检请求处理
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }

  return response;
}

