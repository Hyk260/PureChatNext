import { createHash } from 'node:crypto'
import path from 'node:path'

import { editExcelBuffer, ExcelEditError } from '@pure/utils'
import { tool } from 'ai'
import { z } from 'zod'

import type { ChannelToolArtifact, ChannelToolContext } from './toolRegistry'

const operationSchema = z.discriminatedUnion('type', [
  z.object({
    all: z.boolean().optional().describe('Set true only when the user explicitly wants every match changed'),
    find: z.string().min(1).max(500),
    mode: z.enum(['exact', 'substring']).default('substring'),
    replace: z.string().max(500),
    sheet: z.string().max(100).optional(),
    type: z.literal('replace'),
  }),
  z.object({
    cell: z.string().regex(/^[A-Za-z]{1,3}[1-9]\d{0,6}$/),
    sheet: z.string().min(1).max(100),
    type: z.literal('set'),
    value: z.union([z.string().max(10_000), z.number()]),
  }),
])

const outputName = (sourceName: string, version: number) => {
  const extension = path.extname(sourceName)
  const stem = path.basename(sourceName, extension).replace(/-v\d+$/i, '')
  return `${stem}-v${version}.xlsx`
}

export const createEditExcelTool = (context: ChannelToolContext) =>
  tool({
    description:
      'Edit a persisted .xlsx file from the current WeChat conversation and create a new version. Use this only after the user clearly requests an Excel modification. Never claim success unless this tool returns success=true. If fileId is omitted, the most recent Excel file is used.',
    inputSchema: z.object({
      fileId: z.string().optional().describe('Stable file id from the conversation attachment list'),
      operations: z.array(operationSchema).min(1).max(20),
    }),
    execute: async ({ fileId, operations }) => {
      try {
        const available = await context.files.list(context.sessionId, context.conversationVersion)
        const candidates = available.filter(({ file }) => path.extname(file.name).toLowerCase() === '.xlsx')
        const selected = fileId
          ? candidates.find(({ file }) => file.id === fileId)
          : candidates.find(({ artifact }) => artifact.direction === 'output') ?? candidates[0]
        if (!selected) {
          return { error: '当前会话没有可编辑的 .xlsx 文件，请先上传文件。', success: false as const }
        }

        const source = await context.files.read(context.userId, selected.file.id)
        const edited = editExcelBuffer(source.buffer, source.file.name, operations)
        const version = selected.artifact.version + 1
        const summary = edited.changes
          .slice(0, 20)
          .map(({ cell, from, sheet, to }) => `${sheet}!${cell}: ${String(from ?? '')} → ${String(to)}`)
          .join('；')
        const operationHash = createHash('sha256')
          .update(JSON.stringify({ operations, sourceFileId: selected.file.id }))
          .digest('hex')
        const artifact = await context.files.persist({
          buffer: edited.buffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          direction: 'output',
          event: context.event,
          filename: outputName(source.file.name, version),
          operationHash,
          sourceFileId: source.file.id,
          summary,
          userId: context.userId,
          version,
        })
        const toolArtifact: ChannelToolArtifact = {
          artifactId: artifact.artifactId,
          fileId: artifact.file.id,
          filename: artifact.file.name,
          size: artifact.file.size,
          summary,
        }
        context.producedArtifacts.push(toolArtifact)
        return {
          changes: edited.changes,
          fileId: artifact.file.id,
          filename: artifact.file.name,
          success: true as const,
          summary,
          version,
        }
      } catch (error) {
        if (error instanceof ExcelEditError) {
          return { code: error.code, error: error.message, success: false as const }
        }
        return {
          error: error instanceof Error ? error.message : 'Excel 编辑失败。',
          success: false as const,
        }
      }
    },
  })
