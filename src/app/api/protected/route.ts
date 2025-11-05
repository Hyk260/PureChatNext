import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/libs/jwt';

const testToken = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJhZG1pbiIsImlhdCI6MTc2MjMzMjU4MywiZXhwIjoxNzYyMzMzNDgzfQ.lp684UTU2klD5QuYSSqa9qsQFe0W5qbk3evZ-ZmboH4"

/**
 * JWT 验证测试接口
 * GET /api/protected
 * 
 * Headers:
 *   Authorization: Bearer <token>
 */
export async function GET(request: NextRequest) {
  try {
    // 从 Authorization header 中获取 token
    const authHeader = request.headers.get('authorization') || testToken;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { 
          success: false,
          error: '缺少 Authorization header 或格式不正确',
          message: '请提供 Bearer token，格式: Authorization: Bearer <token>'
        },
        { status: 401 }
      );
    }

    // 提取 token
    const token = authHeader.substring(7); // 移除 "Bearer " 前缀

    if (!token) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Token 不能为空'
        },
        { status: 401 }
      );
    }

        // 验证 token
    try {
      const payload = await verifyToken(token);

      if (!payload) {
        return NextResponse.json(
          {
            success: false,
            error: 'Token 验证失败',
            message: 'JWT 验证失败，可能的原因：1. Token 已过期 2. Token 签名无效 3. Secret 不匹配'
          },
          { status: 401 }
        );
      }

      // 返回验证成功的结果
      return NextResponse.json(
        {
          success: true,
          message: 'JWT 验证成功',
          data: {
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
            exp: payload.exp,
          }
        },
        { status: 200 }
      );

    } catch (verifyError) {
      // 单独捕获验证错误，提供更详细的错误信息
      const errorMessage = verifyError instanceof Error ? verifyError.message : '未知错误'
      const errorCode = (verifyError as { code?: string })?.code || 'UNKNOWN'
      
      console.error('Token 验证详细错误:', {
        code: errorCode,
        message: errorMessage,
        error: verifyError
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Token 验证失败',
          message: `JWT 验证错误: ${errorMessage}`,
          code: errorCode,
          hint: errorCode === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' 
            ? '签名验证失败，请确保 token 是用相同的 secret 签名的'
            : '请检查 token 是否有效或已过期'
        },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('JWT 验证错误:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '服务器内部错误',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}
