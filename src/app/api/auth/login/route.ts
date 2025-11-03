import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/libs/supabase/client';
import { corsMiddleware } from '@/libs/cors';

/**
 * 登录接口
 * POST /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 验证输入
    if (!email || !password) {
      const response = NextResponse.json(
        { error: '邮箱和密码不能为空' },
        { status: 400 }
      );
      return corsMiddleware(request, response);
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const response = NextResponse.json(
        { error: '邮箱格式不正确' },
        { status: 400 }
      );
      return corsMiddleware(request, response);
    }

    // 使用 Supabase 进行登录
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const response = NextResponse.json(
        { error: error.message || '登录失败，请检查邮箱和密码' },
        { status: 401 }
      );
      return corsMiddleware(request, response);
    }

    if (!data.user || !data.session) {
      const response = NextResponse.json(
        { error: '登录失败，无法创建会话' },
        { status: 500 }
      );
      return corsMiddleware(request, response);
    }

    // 返回成功响应
    const response = NextResponse.json(
      {
        message: '登录成功',
        user: {
          id: data.user.id,
          email: data.user.email,
          created_at: data.user.created_at,
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      },
      { status: 200 }
    );

    // 设置 CORS 头
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

