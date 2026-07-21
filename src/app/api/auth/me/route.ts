import { type NextRequest, NextResponse } from 'next/server';

import { UserModel } from '@/database/models/user';
import { verifyAuth } from '@/libs/auth/middleware';

/**
 * GET /api/auth/me
 *
 * 获取当前用户信息
 */
export const GET = async (req: NextRequest) => {
  const { user: jwtPayload, error } = await verifyAuth(req);

  if (!jwtPayload) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const user = await UserModel.findByUserId(jwtPayload.userId);

  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }

  const { password: _, ...userWithoutPassword } = user;

  return NextResponse.json({
    message: 'ok',
    code: 200,
    data: userWithoutPassword,
  });
};

