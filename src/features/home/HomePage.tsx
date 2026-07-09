'use client'

import { Flexbox } from '@lobehub/ui'
import { memo } from 'react'

import NavHeader from '@/features/home/components/NavHeader'
import WideScreenContainer from '@/features/home/components/WideScreenContainer'
import HomeContent from '@/features/home/HomeContent'

const HomePage = memo(() => {
  return (
    <Flexbox height='100%' width='100%'>
      <NavHeader />
      <Flexbox
        flex={1}
        height='100%'
        style={{ overflowY: 'auto', paddingBlock: '0 16vh' }}
        width='100%'
      >
        {/* <WideScreenContainer style={{ paddingBlock: 24 }}>
          <HomeContent />
        </WideScreenContainer> */}
      </Flexbox>
    </Flexbox>
  )
})

HomePage.displayName = 'HomePage'

export default HomePage
