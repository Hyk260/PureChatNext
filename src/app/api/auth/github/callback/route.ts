import debug from 'debug';
import { NextResponse, type NextRequest } from 'next/server';

import GitHubAPI, { type ClientType } from '@/libs/auth/gtihub';
import { signAccessToken, signRefreshToken } from '@/libs/auth/jwt';
import { generateUserSig } from '@/libs/utils/signature';
import { registerAccount } from '@/libs/utils/register';

const log = debug('auth:github-callback');

/**
 * GitHub OAuth 回调
 * GET /api/auth/github/callback?code=xxx&client=web|app
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const client = (searchParams.get('client') || 'web') as ClientType;

    if (!code) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    const userInfo = await GitHubAPI.getUserInfo(code, client);

    if (!userInfo) {
      return NextResponse.json({ error: '授权失败' }, { status: 400 });
    }

    log('GitHub user info: %O', userInfo);

    const githubId = userInfo.id?.toString();
    const githubLogin = userInfo.login || '';
    const avatarUrl = userInfo.avatar_url || '';

    if (!githubId) {
      return NextResponse.json({ error: '无效的 GitHub 用户' }, { status: 400 });
    }

    log('GitHub user fetched: %s (%s)', githubId, githubLogin);

    const { status: imStatus } = await registerAccount({
      id: githubId,
      nick: githubLogin,
      avatar: avatarUrl,
    });

    log('IM account ready: %s status=%s', githubId, imStatus);

    const userSig = generateUserSig({ identifier: githubId });
    const accessToken = await signAccessToken(githubId);
    const { token: refreshToken } = await signRefreshToken(githubId);

    return NextResponse.json(
      {
        message: '登录成功',
        code: 200,
        data: {
          userId: githubId,
          userSig,
          accessToken,
          refreshToken,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    log('callback error: %O', error);

    if (error instanceof Error && error.message.includes('Import account')) {
      return NextResponse.json({ error: 'IM 账号注册失败' }, { status: 502 });
    }

    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
