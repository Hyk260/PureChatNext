import { NextRequest, NextResponse } from 'next/server';

/**
 * 鉴权中间件
 * 验证请求中的 token 是否有效
 */
export async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  // return getUserFromRequest(authHeader);
}

/**
 * 检查用户是否已登录的辅助函数
 */
export async function requireAuth(request: NextRequest) {
  // const { user, error } = await verifyAuth(request);

  // if (!user) {
  //   return NextResponse.json(
  //     { error: error || '需要认证' },
  //     { status: 401 }
  //   );
  // }

  return null;
}

