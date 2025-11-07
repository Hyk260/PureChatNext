import { NextRequest } from 'next/server';
import { verifyToken, type JWTPayload } from '@/libs/jwt';
import { logger } from '@/libs/logger';

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
  if (!authHeader) {
    return {
      user: null,
      error: '缺少 Authorization header',
    };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return {
      user: null,
      error: "Authorization header 格式不正确，应为 Bearer {token}",
    }
  }

  // 提取 token 移除 "Bearer " 前缀
  const token = authHeader.substring(7);

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
        error: "Token 无效或已过期",
      }
    }

    if (!payload.userId) {
      return {
        user: null,
        error: "Token payload 缺少必要字段",
      }
    }

    return {
      user: payload,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`[VerifyAuth] Token verification error: ${errorMessage}`)

    return {
      user: null,
      error: `Token 验证失败: ${errorMessage}`,
    };
  }
}

