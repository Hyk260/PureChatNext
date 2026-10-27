import type { CustomProviderItem } from '@pure/database/schemas/customProvider'

type PublicProviderSource = Pick<
  CustomProviderItem,
  'baseURL' | 'description' | 'enabled' | 'providerId' | 'logo' | 'name'
>

export const toPublicProvider = (provider: PublicProviderSource) => ({
  baseURL: provider.baseURL,
  description: provider.description,
  enabled: provider.enabled,
  id: provider.providerId,
  logo: provider.logo,
  name: provider.name,
})
