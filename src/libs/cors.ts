import { NextResponse } from "next/server"

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export function handleCors(request: Request) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 200,
      headers: corsHeaders,
    })
  }
  return null
}

export function addCorsHeaders(response: NextResponse) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

export const corsMiddleware = (request: Request, response?: NextResponse) => {
  const preflight = handleCors(request)
  if (preflight) return preflight

  if (response) return addCorsHeaders(response)

  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  })
}
