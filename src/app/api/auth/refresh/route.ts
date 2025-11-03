import { NextRequest, NextResponse } from 'next/server';
import { corsMiddleware } from '@/libs/cors';

/**
 * 刷新 Token 接口
 * POST /api/auth/refresh
 */
export async function POST(request: NextRequest) {

}

/**
 * 处理 OPTIONS 预检请求
 */
export async function OPTIONS(request: NextRequest) {
  return corsMiddleware(request);
}

