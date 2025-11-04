import { NextRequest, NextResponse } from "next/server";
import { pino } from '@/libs/logger';
import { corsMiddleware } from '@/libs/utils/cors';
import { API_METHODS, ApiMethodName } from './handlers';
import { parseRequestBodyUtf8 } from '@/libs/utils/http';

/**
 * REST API
 * GET /api/rest-api
 */
export async function GET(request: NextRequest) {
  pino.info(`REST API GET: ${request.url}`);

  const response = NextResponse.json(
    {
      message: "REST API",
      availableMethods: Object.keys(API_METHODS),
    },
    { status: 200 }
  );

  return corsMiddleware(request, response);
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
    type RestApiRequestBody = { funName?: ApiMethodName; params?: unknown };
    const body = (await parseRequestBodyUtf8(request)) as RestApiRequestBody | string;
    const { funName, params = {} } = (typeof body === 'string' ? {} as RestApiRequestBody : body);

    pino.info(`REST API POST: funName=${funName}, params=${JSON.stringify(params)}`);

    // 验证函数名
    if (!funName || !(funName in API_METHODS)) {
      pino.warn(`Invalid function name: ${funName}`);
      const response = NextResponse.json(
        {
          success: false,
          error: "Invalid function name",
          availableMethods: Object.keys(API_METHODS),
        },
        { status: 400 }
      );

      return corsMiddleware(request, response);
    }

    // 调用相应的API方法
    const method = API_METHODS[funName as ApiMethodName] as (p: unknown) => Promise<unknown>;
    const result = await method(params);

    pino.info(`REST API POST success: funName=${funName}`);

    const response = NextResponse.json(
      {
        success: true,
        result,
      },
      { status: 200 }
    );

    return corsMiddleware(request, response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    pino.error(`REST API POST error: ${errorMessage}`);

    const response = NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
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