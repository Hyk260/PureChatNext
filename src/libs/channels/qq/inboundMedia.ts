import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { loadFile } from '@pure/file-loaders'

export const QQ_MAX_INBOUND_FILE_BYTES = 10 * 1024 * 1024
export const QQ_MAX_PARSED_FILE_CHARS = 120_000

export type PreparedQQFile = {
  buffer: Buffer
  content: string
  fileName: string
  fileType: string
  mimeType: string
  truncated: boolean
}

/** 下载完成后解析 QQ 文件，提取可读文本并截断，供 Agent 直接消费。 */
export async function prepareQQFileForAgent(input: {
  buffer: Buffer
  fileName?: string
  mimeType?: string
}): Promise<PreparedQQFile> {
  if (input.buffer.byteLength > QQ_MAX_INBOUND_FILE_BYTES) {
    throw new Error('文件超过 10MB 限制，无法处理。')
  }

  const fileName = path.basename(input.fileName || 'qq-file') || 'qq-file'
  // 临时目录路径在运行时才确定；忽略 Turbopack 文件追踪，避免整仓打进 server bundle
  const tempDir = await mkdtemp(path.join(/*turbopackIgnore: true*/ os.tmpdir(), 'purechat-qq-'))
  const filePath = path.join(/*turbopackIgnore: true*/ tempDir, fileName)
  try {
    await writeFile(filePath, input.buffer)
    const document = await loadFile(filePath, { filename: fileName, fileType: path.extname(fileName).slice(1) })
    if (document.metadata.error) throw new Error(`文件解析失败：${document.metadata.error}`)
    const raw = document.content.trim()
    if (!raw) throw new Error('文件没有可读取的文本内容。')
    const content = raw.slice(0, QQ_MAX_PARSED_FILE_CHARS)
    return {
      buffer: input.buffer,
      content,
      fileName,
      fileType: document.fileType,
      mimeType: input.mimeType || 'application/octet-stream',
      truncated: raw.length > content.length,
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
