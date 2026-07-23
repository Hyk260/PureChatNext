'use client'

import { Flex } from 'antd'
import { memo } from 'react'

import NavHeader from '@/features/home/components/NavHeader'
import WideScreenContainer from '@/features/home/components/WideScreenContainer'
import HomeContent from '@/features/home/HomeContent'

const HomePage = memo(() => {
  return (
    <Flex vertical style={{ height: '100%', width: '100%' }}>
      <NavHeader />
      <Flex vertical flex={1} style={{ height: '100%', overflowY: 'auto', paddingBlock: '0 16vh', width: '100%' }}>
        <WideScreenContainer style={{ paddingBlock: 24 }}>
          <HomeContent />
        </WideScreenContainer>
      </Flex>
    </Flex>
  )
})

HomePage.displayName = 'HomePage'

export default HomePage
