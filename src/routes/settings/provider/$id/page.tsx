'use client'

import { Navigate, useParams } from 'react-router'

import ProviderDetailPage from '@/features/settings/provider/ProviderDetailPage'
import { isSettingsProviderId } from '@/features/settings/provider/const'
import { Flex, Text } from '@pure/ui'
import { useCustomProviderRegistry } from '@/features/settings/provider/useCustomProviderRegistry'

export default function Page() {
  const { id } = useParams<{ id: string }>()
  const { data: customProviders, error } = useCustomProviderRegistry()

  if (!id) {
    return <Navigate replace to='/settings/provider/all' />
  }

  if (!customProviders && !error) {
    return (
      <Flex className='w-full justify-center py-12'>
        <Text type='secondary'>正在加载服务商...</Text>
      </Flex>
    )
  }

  const isAvailable = isSettingsProviderId(id) || customProviders?.some((provider) => provider.id === id)
  if (!isAvailable) return <Navigate replace to='/settings/provider/all' />

  return <ProviderDetailPage id={id} />
}
