import { NextRequest, NextResponse } from "next/server";
import {
  getUserByEmailAndPassword,
  getUserByLoginIdAndPassword,
} from "@/database/queries";
import { generateUserSig } from "@/libs/utils/signature";
import { generateAccessToken, generateRefreshToken } from "@/libs/jwt";
import { isValidEmail } from "@/utils";

interface LoginRequestBody {
  email?: string;
  username?: string;
  password: string;
}

interface LoginResponse {
  message: string;
  code: number;
  data?: {
    username: string;
    userSig: string;
    accessToken: string;
    refreshToken: string;
  };
  error?: string;
  timestamp: string;
}

// 常量配置
const LOGIN_CONFIG = {
  MIN_PASSWORD_LENGTH: 6,
  MAX_LOGIN_ATTEMPTS: 5, // 可扩展为实际频率限制
  ERROR_MESSAGES: {
    INVALID_CREDENTIALS: "用户名或密码错误",
    INVALID_INPUT: "用户名/邮箱和密码不能为空",
    SERVER_ERROR: "服务器内部错误",
    PASSWORD_TOO_SHORT: "密码长度不能少于6位"
  }
} as const;

/**
 * 输入验证函数
 */
function validateInput(data: LoginRequestBody): string | null {
  // 检查基本字段
  if (!data.password || (!data.email && !data.username)) {
    return LOGIN_CONFIG.ERROR_MESSAGES.INVALID_INPUT;
  }

  // 密码长度验证
  if (data.password.length < LOGIN_CONFIG.MIN_PASSWORD_LENGTH) {
    return LOGIN_CONFIG.ERROR_MESSAGES.PASSWORD_TOO_SHORT;
  }

  // 邮箱格式验证（如果提供）
  if (data.email && !isValidEmail(data.email)) {
    return "邮箱格式不正确";
  }

  return null;
}

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
