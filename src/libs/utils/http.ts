import { NextRequest } from 'next/server';

/**
 * 以 UTF-8 解码解析请求体，支持 JSON / text / x-www-form-urlencoded。
 * 返回解析后的对象或原始字符串/键值对象。
 */
export async function parseRequestBodyUtf8(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json') || contentType.includes('text/plain')) {
    const buffer = await request.arrayBuffer();
    const text = new TextDecoder('utf-8').decode(buffer);
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const paramsObj: Record<string, unknown> = {};
    const usp = new URLSearchParams(text);
    usp.forEach((v, k) => {
      try { paramsObj[k] = JSON.parse(v); } catch { paramsObj[k] = v; }
    });
    return paramsObj;
  }

  try {
    return await request.json();
  } catch {
    return {};
  }
}


