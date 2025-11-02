import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { corsMiddleware } from '@/lib/utils/cors';

/**
 * 注册接口
 * POST /api/auth/register
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

    // 验证密码长度
    if (password.length < 6) {
      const response = NextResponse.json(
        { error: '密码长度至少为 6 个字符' },
        { status: 400 }
      );
      return corsMiddleware(request, response);
    }

    // 使用 Supabase 进行注册
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      const response = NextResponse.json(
        { error: error.message || '注册失败' },
        { status: 400 }
      );
      return corsMiddleware(request, response);
    }

    if (!data.user) {
      const response = NextResponse.json(
        { error: '注册失败，无法创建用户' },
        { status: 500 }
      );
      return corsMiddleware(request, response);
    }

    // 返回成功响应
    const response = NextResponse.json(
      {
        message: '注册成功',
        user: {
          id: data.user.id,
          email: data.user.email,
          created_at: data.user.created_at,
        },
        session: data.session
          ? {
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_at: data.session.expires_at,
            }
          : null,
      },
      { status: 201 }
    );

    return corsMiddleware(request, response);
  } catch (error) {
    console.error('Register error:', error);
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

