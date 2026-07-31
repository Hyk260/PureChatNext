'use client'

import { memo } from 'react'

import { Flexbox } from '@pure/ui'
import ProviderList from '@/features/community/components/ProviderList'
import { COMMUNITY_PROVIDERS } from '@/const/community/providers'

const ProviderPage = memo(() => {
  return (
    <Flexbox gap={32} style={{ width: '100%' }}>
      <ProviderList data={COMMUNITY_PROVIDERS} />
    </Flexbox>
  )
})

ProviderPage.displayName = 'ProviderPage'

export default ProviderPage
