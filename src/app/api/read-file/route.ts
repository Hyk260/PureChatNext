import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { type NextRequest, NextResponse } from 'next/server';
import { loadFile, UnsupportedFileTypeError } from '@pure/file-loaders';

/**
 * 解析文件内容
 * POST /api/read-file
 *
 * 支持两种入参方式：
 * 1. 上传文件: multipart/form-data, 字段名 "file"
 * 2. 传入 URL: application/json, body: { "url": "https://example.com/file.pdf" }
 */

async function downloadFromUrl(url: string): Promise<{ buffer: Buffer; filename: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const urlPath = new URL(url).pathname;
  const filename = urlPath.split('/').pop() || 'downloaded-file';
  return { buffer, filename };
}

async function saveTempFile(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '';
  const tmpPath = join(tmpdir(), `read-file-${randomUUID()}${ext}`);
  await writeFile(tmpPath, buffer);
  return tmpPath;
}

export async function POST(request: NextRequest) {
  let tmpPath: string | null = null;

  try {
    const contentType = request.headers.get('content-type') || '';
    let buffer: Buffer;
    let filename: string;

    if (contentType.includes('multipart/form-data')) {
      // 方式1: 文件上传
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: 'Missing or invalid "file" field' }, { status: 400 });
      }
      buffer = Buffer.from(await file.arrayBuffer());
      filename = file.name;
    } else if (contentType.includes('application/json')) {
      // 方式2: URL 下载
      const body = await request.json();
      const url = body.url;
      if (!url || typeof url !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid "url" field' }, { status: 400 });
      }
      const downloaded = await downloadFromUrl(url);
      buffer = downloaded.buffer;
      filename = downloaded.filename;
    } else {
      return NextResponse.json(
        { error: 'Use multipart/form-data for file upload or application/json with { "url": "..." }' },
        { status: 400 },
      );
    }

    // 写入临时文件
    tmpPath = await saveTempFile(buffer, filename);

    // 调用 loadFile 解析
    const result = await loadFile(tmpPath, { filename, source: tmpPath });

    // 清理临时文件
    await unlink(tmpPath).catch(() => {});

    return NextResponse.json(result);
  } catch (error) {
    // 清理临时文件
    if (tmpPath) {
      await unlink(tmpPath).catch(() => {});
    }

    if (error instanceof UnsupportedFileTypeError) {
      return NextResponse.json({ error: error.message }, { status: 415 });
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
