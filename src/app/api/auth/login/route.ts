import { NextRequest, NextResponse } from "next/server";
import {
  getUserByEmailAndPassword,
  getUserByLoginIdAndPassword,
} from "@/database/queries";
import { generateUserSig } from "@/libs/utils/signature";
import { generateAccessToken, generateRefreshToken } from "@/libs/jwt";

/**
 * 登录接口
 * POST /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码不能为空" },
        { status: 400 }
      );
    }

    let user = null;
    if (email) {
      // 通过邮箱登录
      user = await getUserByEmailAndPassword(email, password);
    } else if (username) {
      // 通过 login_id 登录
      user = await getUserByLoginIdAndPassword(username, password);
    }

    if (!user) {
      return NextResponse.json(
        {
          error: "用户名或密码错误",
        },
        { status: 400 }
      );
    }

    const identifier = user.login_id || username || email;
    const userSig = generateUserSig({ identifier });
    const accessToken = await generateAccessToken(user.login_id);
    const { token: refreshToken } = await generateRefreshToken(user.login_id);

    // 返回成功响应
    return NextResponse.json(
      {
        message: "登录成功",
        code: 200,
        data: {
          username: user.login_id,
          userSig,
          accessToken,
          refreshToken,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
