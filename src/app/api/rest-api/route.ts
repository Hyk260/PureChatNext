import { NextRequest, NextResponse } from "next/server";
import { pino } from '@/libs/logger';

/**
 * REST API
 * GET /api/rest-api
 */
export async function GET(request: NextRequest) {
  pino.info(`REST API GET: request: ${JSON.stringify(request)}`);

  return NextResponse.json(
    {
      message: "REST API",
    },
    { status: 200 }
  );
}

/**
 * REST API
 * POST /api/rest-api
 */
export async function POST(request: NextRequest) {
  pino.info(`REST API POST: request: ${JSON.stringify(request)}`);

  return NextResponse.json(
    {
      message: "REST API POST",
    },
    { status: 200 }
  );
}