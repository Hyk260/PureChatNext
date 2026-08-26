'use client'

import { memo } from 'react'

import { Flexbox } from '@pure/ui'
import Scrollbar from '@/components/Scrollbar'
import ProviderList from '@/features/community/components/ProviderList'
import { COMMUNITY_PROVIDERS } from '@/const/community/providers'

const ProviderPage = memo(() => {
  return (
    <Scrollbar
      style={{ height: '100%', width: '100%' }}
      viewStyle={{ paddingInlineEnd: 24 }}
      wrapClassName='community-scroll-viewport'
    >
      <Flexbox gap={32} style={{ width: '100%' }}>
        <ProviderList data={COMMUNITY_PROVIDERS} />
      </Flexbox>
    </Scrollbar>
  )
})

ProviderPage.displayName = 'ProviderPage'

export default ProviderPage
