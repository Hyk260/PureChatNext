'use client'

import { memo } from 'react'

import { Flexbox } from '@pure/ui'
import NavHeader from '@/features/home/components/NavHeader'
import WideScreenContainer from '@/features/home/components/WideScreenContainer'
import HomeContent from '@/features/home/HomeContent'

const HomePage = memo(() => {
  return (
    <Flexbox style={{ height: '100%', width: '100%' }}>
      <NavHeader />
      <Flexbox flex={1} style={{ height: '100%', overflowY: 'auto', paddingBlock: '0 16vh', width: '100%' }}>
        <WideScreenContainer style={{ paddingBlock: 24 }}>
          <HomeContent />
        </WideScreenContainer>
      </Flexbox>
    </Flexbox>
  )
})

HomePage.displayName = 'HomePage'

export default HomePage
