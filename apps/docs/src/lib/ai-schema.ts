import { z } from 'zod'

export const searchDocsInputSchema = z.object({
  query: z.string().trim().min(1).max(200).describe('用于检索 PureChatNext 文档的简短中文关键词'),
})
