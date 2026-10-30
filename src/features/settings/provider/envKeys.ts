'use client'

import { apiFetch } from '@/utils/apiFetch'

export type ProviderEnvKeyFlags = {
  bailian: boolean
  deepseek: boolean
  openai: boolean
}

let cached: ProviderEnvKeyFlags | null = null
let inflight: Promise<ProviderEnvKeyFlags> | null = null

export const resetProviderEnvKeyCacheForTests = (): void => {
  cached = null
  inflight = null
}

const flagsFromWindow = (): ProviderEnvKeyFlags | null => {
  if (typeof window === 'undefined') return null
  const keys = window.__SERVER_CONFIG__?.providerEnvKeys
  if (!keys) return null
  return {
    bailian: keys.bailian === true,
    deepseek: keys.deepseek === true,
    openai: keys.openai === true,
  }
}

export const loadProviderEnvKeyFlags = (): Promise<ProviderEnvKeyFlags> => {
  const injected = flagsFromWindow()
  if (injected) {
    cached = injected
    return Promise.resolve(injected)
  }
  if (cached) return Promise.resolve(cached)
  if (inflight) return inflight

  inflight = apiFetch('/api/providers/config')
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load provider env keys (${response.status})`)
      }
      const data = (await response.json()) as { envKeys?: Partial<ProviderEnvKeyFlags> }
      const flags: ProviderEnvKeyFlags = {
        bailian: data.envKeys?.bailian === true,
        deepseek: data.envKeys?.deepseek === true,
        openai: data.envKeys?.openai === true,
      }
      cached = flags
      return flags
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

/** `undefined` means we could not tell (config fetch failed) — caller should not block. */
export const providerHasEnvApiKey = async (provider: string): Promise<boolean | undefined> => {
  if (provider === 'purechat') return true
  if (provider !== 'openai' && provider !== 'deepseek' && provider !== 'bailian') return undefined

  try {
    const flags = await loadProviderEnvKeyFlags()
    return flags[provider]
  } catch {
    return undefined
  }
}
