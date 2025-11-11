import { NextRequest, NextResponse } from "next/server";
import { logger } from '@/libs/logger';
import { API_METHODS, ApiMethodName } from './handlers';

const safeJsonStringify = (value: unknown) => {
  try {
    return JSON.stringify(value)
  } catch {
    return value
  }
}

/**
 * REST API
 * POST /api/rest-api
 * 
 * Request body:
 * {
 *   funName: "accountCheck" | "accountImport" | "restSendMsg" | "addGroupMember",
 *   params: { ... }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { funName, params } = body

    logger.info(`[REST API POST] funName: ${funName}`);

    logger.info(`[REST API POST] params: ${safeJsonStringify(params)}`);
    
    // 验证函数名
    if (!funName || !(funName in API_METHODS)) {
      logger.warn(`Invalid function name: ${funName}`);
      const response = NextResponse.json(
        {
          success: false,
          error: "Invalid function name",
          availableMethods: Object.keys(API_METHODS),
        },
        { status: 400 }
      );

      return response
    }

    // 调用相应的API方法
    const method = API_METHODS[funName as ApiMethodName] as (p: unknown) => Promise<unknown>;
    const result = await method(params);

    logger.info(`REST API POST success: funName=${funName}`);

    return NextResponse.json(
      {
        success: true,
        result,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`REST API POST error: ${errorMessage}`);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * REST API
 * GET /api/rest-api
 */
export async function GET(request: NextRequest) {
  logger.info(`REST API GET: ${request.url}`);

  const response = NextResponse.json(
    {
      message: "REST API",
      availableMethods: Object.keys(API_METHODS),
    },
    { status: 200 }
  );

  return response
}