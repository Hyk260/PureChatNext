import { FETCH_PROVIDER_IDS, SEARCH_PROVIDER_IDS, WEB_PROVIDER_CATALOG } from '@pure/types'
import { z } from 'zod'

import { invalidBlacklistRules } from './resultProcessing'

const optionalText = z.string().trim().max(2048).nullable().optional()
const endpoint = optionalText.refine((value) => {
  if (!value) return true
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.hash && !url.search
  } catch {
    return false
  }
}, 'API 地址必须是无凭证、查询参数和片段的 HTTP(S) URL')

const providerSchema = z
  .object({
    apiKeys: z
      .array(z.string().trim().min(1).max(8192))
      .max(50)
      .transform((keys) => [...new Set(keys)])
      .nullable()
      .optional(),
    searchBaseURL: endpoint,
    fetchBaseURL: endpoint,
    engineId: optionalText,
    basicAuthUsername: optionalText,
    basicAuthPassword: z.string().max(8192).nullable().optional(),
  })
  .strict()

export const webSearchSettingsPatchSchema = z
  .object({
    searchProvider: z.enum(SEARCH_PROVIDER_IDS).nullable().optional(),
    fetchProvider: z.enum(FETCH_PROVIDER_IDS).nullable().optional(),
    maxResults: z.number().int().min(1).max(100).nullable().optional(),
    compression: z.enum(['none', 'cutoff']).nullable().optional(),
    cutoffLimit: z.number().int().positive().max(128000).nullable().optional(),
    blacklist: z
      .array(z.string().trim().min(1).max(512))
      .max(100)
      .superRefine((rules, ctx) => {
        const invalid = invalidBlacklistRules(rules)
        if (invalid.length) ctx.addIssue({ code: 'custom', message: `无效黑名单规则：${invalid.join('、')}` })
      })
      .nullable()
      .optional(),
    modelToolsPreferred: z.boolean().nullable().optional(),
    providers: z
      .record(z.string(), providerSchema.nullable())
      .refine(
        (providers) => Object.keys(providers).every((id) => Object.hasOwn(WEB_PROVIDER_CATALOG, id)),
        '未知服务商'
      )
      .optional(),
  })
  .strict()

export const webSearchCheckSchema = z
  .object({
    capability: z.enum(['search', 'fetch']),
    provider: z.string(),
  })
  .strict()
  .refine(({ capability, provider }) => {
    const ids: readonly string[] = capability === 'search' ? SEARCH_PROVIDER_IDS : FETCH_PROVIDER_IDS
    return ids.includes(provider)
  }, '服务商不支持所选能力')
