import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { loadFile } from '@pure/file-loaders'
import { tool } from 'ai'
import { z } from 'zod'

import type { ChannelToolContext } from './toolRegistry'

const MAX_PARSED_FILE_CHARS = 120_000

export const createReadFileTool = (context: ChannelToolContext) =>
  tool({
    description:
      'Read a text-readable file from the current conversation, including TXT, PDF, DOCX, XLSX, and PPTX. Use this when the user asks about an uploaded file. If fileId is omitted, use the most recent matching file.',
    inputSchema: z.object({
      fileId: z.string().optional().describe('Stable file id from the conversation attachment list'),
    }),
    execute: async ({ fileId }) => {
      const available = await context.files.list(context.sessionId, context.conversationVersion)
      const selected = fileId
        ? available.find(({ file }) => file.id === fileId)
        : available.find(({ artifact }) => artifact.direction === 'output') ?? available[0]
      if (!selected) return { error: '当前会话没有可读取的文件。', success: false as const }

      const source = await context.files.read(context.userId, selected.file.id)
      const fileName = path.basename(source.file.name || 'conversation-file') || 'conversation-file'
      const tempDir = await mkdtemp(path.join(os.tmpdir(), 'purechat-file-'))
      const filePath = path.join(/* turbopackIgnore: true */ tempDir, fileName)
      try {
        await writeFile(filePath, source.buffer)
        const document = await loadFile(filePath, { filename: fileName, fileType: path.extname(fileName).slice(1) })
        if (document.metadata.error) return { error: `文件解析失败：${document.metadata.error}`, success: false as const }
        const content = document.content.trim()
        if (!content) return { error: '文件没有可读取的文本内容。', success: false as const }
        const truncated = content.length > MAX_PARSED_FILE_CHARS
        return {
          content: content.slice(0, MAX_PARSED_FILE_CHARS),
          fileId: source.file.id,
          filename: fileName,
          success: true as const,
          truncated,
        }
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
      }
    },
  })