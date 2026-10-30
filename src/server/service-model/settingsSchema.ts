import { isValidProviderId } from '@pure/const'
import { z } from 'zod'

const modelReferenceSchema = z
  .object({
    provider: z.string().min(1).max(32).refine(isValidProviderId, '服务商 ID 无效'),
    model: z.string().trim().min(1).max(256),
    contextWindowTokens: z.number().int().min(1024).max(2_000_000).optional(),
  })
  .strict()

const speechModelReferenceSchema = modelReferenceSchema.extend({
  voice: z.string().trim().min(1).max(128).optional(),
  endpoint: z.string().trim().max(2048).optional(),
})

export const serviceModelSettingsPatchSchema = z
  .object({
    topicNaming: modelReferenceSchema.nullable().optional(),
    historyCompression: modelReferenceSchema.nullable().optional(),
    qqSpeech: speechModelReferenceSchema.nullable().optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, '至少需要更新一个服务模型设置')
