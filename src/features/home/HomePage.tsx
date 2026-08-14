'use client'

import { memo } from 'react'

import { Flexbox } from '@pure/ui'
import NavHeader from '@/features/home/components/NavHeader'
import WideScreenContainer from '@/features/home/components/WideScreenContainer'
import HomeContent from '@/features/home/HomeContent'

const HomePage = memo(() => {
  return (
    <Flexbox flex={1} style={{ height: '100%', minHeight: 0, width: '100%' }}>
      <NavHeader />
      <Flexbox
        flex={1}
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 0,
          overflowY: 'auto',
          paddingBlock: 24,
          width: '100%',
        }}
      >
        <WideScreenContainer>
          <HomeContent />
        </WideScreenContainer>
      </Flexbox>
      <div className='h-11'></div>
    </Flexbox>
  )
})

HomePage.displayName = 'HomePage'

export default HomePage
