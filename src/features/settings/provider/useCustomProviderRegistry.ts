'use client'

import { useEffect } from 'react'

import { useProviderConfigStore } from './store/useProviderConfigStore'
import { useCustomProviders } from './customProvidersApi'

export function useCustomProviderRegistry() {
  const result = useCustomProviders()
  const setCustomProviders = useProviderConfigStore((state) => state.setCustomProviders)
  const providers = result.data

  useEffect(() => {
    if (providers) setCustomProviders(providers)
  }, [providers, setCustomProviders])

  return result
}
