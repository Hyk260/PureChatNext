import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

/**
 * 登出接口
 * POST /api/auth/logout
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({ message: 'Logout successful' });
}

