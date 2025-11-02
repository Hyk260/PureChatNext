import { NextRequest, NextResponse } from 'next/server';
import { corsMiddleware } from '@/lib/utils/cors';

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
export async function GET(request: NextRequest) {
  
}

/**
 * 处理 OPTIONS 预检请求
 */
export async function OPTIONS(request: NextRequest) {
  return corsMiddleware(request);
}

