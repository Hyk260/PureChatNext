import { NextRequest, NextResponse } from "next/server";
import GitHubAPI, { type ClientType } from "@/libs/auth/gtihub";
import { generateUserSig } from "@/libs/utils/signature";
import { generateAccessToken, generateRefreshToken } from "@/libs/jwt";
import { registerAccount } from "@/libs/utils/register";
import { pino } from '@/libs/logger';

/**
 * GitHub OAuth 回调
 * GET /api/auth/github/callback?code=xxx&client=web|app
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const client = (searchParams.get("client") || "web") as ClientType;

    if (!code) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const userInfo = await GitHubAPI.getUserInfo(code, client);

    if (!userInfo) {
      return NextResponse.json({ error: "授权失败" }, { status: 400 });
    }

    pino.info(`[GitHub] userInfo:${JSON.stringify(userInfo)}`);

    const githubId = userInfo.id?.toString();
    const githubLogin = userInfo?.login || "";
    const avatarUrl = userInfo?.avatar_url || "";

    if (!githubId) {
      return NextResponse.json({ error: "无效的 GitHub 用户" }, { status: 400 });
    }
    // 注册IM账号
    await registerAccount({ id: githubId, nick: githubLogin, avatar: avatarUrl });

    const identifier = githubId;
    const userSig = generateUserSig({ identifier });
    const accessToken = await generateAccessToken(identifier);
    const { token: refreshToken } = await generateRefreshToken(identifier);

    return NextResponse.json(
      {
        message: "登录成功",
        code: 200,
        result: {
          loginId: identifier,
          username: identifier,
          userSig,
          accessToken,
          refreshToken,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GitHub callback error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}


