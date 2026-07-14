'use client'

import { useEffect, useState } from 'react'

import type { AuthServerConfig } from '@/libs/better-auth/shared'

const defaultConfig: AuthServerConfig = {
  emailVerificationMode: 'otp',
  enableEmailVerification: false,
  enableMagicLink: false,
  oAuthSSOProviders: [],
}

let cachedConfig: AuthServerConfig | null = null
let inflight: Promise<AuthServerConfig> | null = null

export const getCachedAuthConfig = (): AuthServerConfig | null => cachedConfig

export const resetAuthConfigCacheForTests = (): void => {
  cachedConfig = null
  inflight = null
}

export const loadAuthServerConfig = (): Promise<AuthServerConfig> => {
  if (cachedConfig) return Promise.resolve(cachedConfig)
  if (inflight) return inflight

  inflight = fetch('/api/auth/config')
    .then((response) => response.json() as Promise<AuthServerConfig>)
    .then((data) => {
      cachedConfig = data
      return data
    })
    .catch(() => {
      cachedConfig = defaultConfig
      return defaultConfig
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

export const useAuthConfig = () => {
  const [config, setConfig] = useState<AuthServerConfig | null>(() => cachedConfig)

  useEffect(() => {
    let cancelled = false

    if (cachedConfig) {
      setConfig(cachedConfig)
      return
    }

    void loadAuthServerConfig().then((data) => {
      if (!cancelled) setConfig(data)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return {
    config: config ?? defaultConfig,
    ready: config !== null,
  }
}
