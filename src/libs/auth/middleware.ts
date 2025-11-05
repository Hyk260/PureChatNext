import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, JWTPayload } from '@/libs/jwt';

/**
 * 鉴权中间件
 * 验证请求中的 token 是否有效
 * @returns 返回验证结果，包含用户信息和错误信息
 */
export async function verifyAuth(request: NextRequest): Promise<{
  user: JWTPayload | null;
  error: string | null;
}> {
  const authHeader = request.headers.get('authorization');

  // 检查 Authorization header 是否存在
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      user: null,
      error: '缺少 Authorization header 或格式不正确，请提供 Bearer token',
    };
  }

  // 提取 token
  const token = authHeader.substring(7); // 移除 "Bearer " 前缀

  if (!token) {
    return {
      user: null,
      error: 'Token 不能为空',
    };
  }

  // 验证 token
  try {
    const payload = await verifyToken(token);

    if (!payload) {
      return {
        user: null,
        error: 'Token 验证失败，可能的原因：1. Token 已过期 2. Token 签名无效 3. Secret 不匹配',
      };
    }

    return {
      user: payload,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return {
      user: null,
      error: `Token 验证失败: ${errorMessage}`,
    };
  }
}

/**
 * 检查用户是否已登录的辅助函数
 * 如果用户未认证，返回 401 响应；否则返回 null
 */
export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
  const { user, error } = await verifyAuth(request);

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: error || '需要认证',
        message: '请提供有效的 Bearer token',
      },
      { status: 401 }
    );
  }

  return null;
}

