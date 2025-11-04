import { NextRequest, NextResponse } from 'next/server';
import { corsMiddleware } from '@/libs/utils/cors';
import { getUserByEmailAndPassword, getUserByLoginIdAndPassword } from '@/database/queries';
import { generateUserSig } from '@/libs/utils/signature';
import { generateAccessToken, generateRefreshToken } from '@/libs/jwt';

/**
 * 登录接口
 * POST /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, username, password } = body;
    
    // 验证输入
    if (!username || !password) {
      const response = NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      );
      return corsMiddleware(request, response);
    }

    let user = null;
    if (email) {
      // 通过邮箱登录
      user = await getUserByEmailAndPassword(email, password);
    } else if(username) {
      // 通过 login_id 登录
      user = await getUserByLoginIdAndPassword(username, password);
    }

    if (!user) {
      const response = NextResponse.json(
        { 
          error: '用户名或密码错误',
          message: '用户名或密码错误'
         },
        { status: 400 }
      );
      return corsMiddleware(request, response);
    }

    const identifier = user.login_id || username || email;
    const userSig = generateUserSig({ identifier });
    const accessToken = await generateAccessToken(user.login_id);
    const { token: refreshToken } = await generateRefreshToken(user.login_id);

    // 返回成功响应
    const response = NextResponse.json(
      {
        message: '登录成功',
        code: 200,
        result: {
          id: user.id,
          email: user.email,
          loginId: user.login_id,
          username: user.login_id,
          userSig,
          accessToken,
          refreshToken,
        },
      },
      { status: 200 }
    );
    
    return corsMiddleware(request, response);
 
  } catch (error) {
    console.error('Login error:', error);
    const response = NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
    return corsMiddleware(request, response);
  }
}

/**
 * 处理 OPTIONS 预检请求
 */
export async function OPTIONS(request: NextRequest) {
  return corsMiddleware(request);
}

