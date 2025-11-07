import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, generateAccessToken, generateRefreshToken } from '@/libs/jwt';

/**
 * 刷新 Token 接口
 * POST /api/auth/refresh
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      const response = NextResponse.json(
        { error: 'refreshToken 不能为空' },
        { status: 400 }
      );
      return response
    }

    const verifyResult = await verifyRefreshToken(refreshToken);

    if (!verifyResult.valid) {
      const response = NextResponse.json(
        {
          error: verifyResult.expired ? '刷新令牌已过期' : '无效的刷新令牌',
        },
        { status: 401 }
      );
      return response
    }

    console.log('verifyResult', verifyResult)

    if (!verifyResult.userId) {
      const response = NextResponse.json(
        { error: '令牌信息不完整' },
        { status: 400 }
      );
      return response
    }

    const accessToken = await generateAccessToken(verifyResult.userId);
    const { token: newRefreshToken } = await generateRefreshToken(verifyResult.userId);

    return NextResponse.json(
      {
        message: '刷新成功',
        code: 200,
        data: {
          accessToken,
          refreshToken: newRefreshToken,
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

