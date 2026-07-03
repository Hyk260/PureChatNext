'use client'

import { useEffect, useState } from 'react'

import type { AuthServerConfig } from '@/libs/better-auth/get-auth-config'

const defaultConfig: AuthServerConfig = {
  emailVerificationMode: 'otp',
  enableEmailVerification: false,
  enableMagicLink: false,
  oAuthSSOProviders: [],
}

export const useAuthConfig = () => {
  const [config, setConfig] = useState<AuthServerConfig | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/auth/config')
      .then((response) => response.json())
      .then((data: AuthServerConfig) => {
        if (!cancelled) setConfig(data)
      })
      .catch(() => {
        if (!cancelled) setConfig(defaultConfig)
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
