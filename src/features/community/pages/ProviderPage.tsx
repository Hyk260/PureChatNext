'use client'

import { Flex } from 'antd'
import { memo } from 'react'

import ProviderList from '@/features/community/components/ProviderList'
import { COMMUNITY_PROVIDERS } from '@/const/community/providers'

const ProviderPage = memo(() => {
  return (
    <Flex vertical gap={32} style={{ width: '100%' }}>
      <ProviderList data={COMMUNITY_PROVIDERS} />
    </Flex>
  )
})

ProviderPage.displayName = 'ProviderPage'

export default ProviderPage
