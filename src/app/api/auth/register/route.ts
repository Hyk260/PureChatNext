import { NextRequest, NextResponse } from "next/server";
import { createUser, getUserByLoginId, getUserByEmail } from "@/database/queries";
import { logger } from '@/libs/logger';

/**
 * 注册接口
 * POST /api/auth/register
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, username: login_id } = body;
    logger.info(`[POST /api/auth/register] email:${email} password:${password} login_id:${login_id}`);

    // 验证输入
    if (!email || !password || !login_id) {
      const response = NextResponse.json(
        {
          error: "邮箱、密码和登录ID不能为空",
        },
        { status: 400 }
      );
      return response;
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const response = NextResponse.json(
        {
          error: "邮箱格式不正确",
        },
        { status: 400 }
      );
      return response;
    }

    // 验证密码长度
    if (password.length < 6) {
      const response = NextResponse.json(
        {
          error: "密码长度至少为 6 个字符",
        },
        { status: 400 }
      );
      return response;
    }

    // 验证 login_id：仅允许小写字母和数字，长度 4-32
    const loginIdRegex = /^[a-z0-9]+$/;
    if (!loginIdRegex.test(login_id)) {
      const response = NextResponse.json(
        {
          error: "登录ID只能包含小写字母和数字",
        },
        { status: 400 }
      );
      return response;
    }

    if (login_id.length < 4 || login_id.length > 32) {
      const response = NextResponse.json(
        {
          error: "登录ID长度必须在 4-32 个字符之间",
        },
        { status: 400 }
      );
      return response;
    }

    // 检查 login_id 是否已存在
    const existingUser = await getUserByLoginId(login_id);
    if (existingUser) {
      const response = NextResponse.json(
        {
          error: "该登录ID已被使用",
        },
        { status: 400 }
      );
      return response;
    }

    if (email) {
      const existingEmail = await getUserByEmail(email);
      if (existingEmail) {
        const response = NextResponse.json(
          {
            error: "该邮箱已被注册",
          },
          { status: 400 }
        );
        return response;
      }
    }

    // 创建用户
    const newUser = await createUser(email, password, login_id);

    // 返回成功响应
    return NextResponse.json(
      {
        message: "注册成功",
        code: 200,
        data: {
          email: newUser.email,
          username: newUser.login_id,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(error, "Register error:");
    return NextResponse.json(
      {
        error: "服务器内部错误",
      },
      { status: 500 }
    );
  }
}
