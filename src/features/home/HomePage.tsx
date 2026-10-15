'use client'

import { memo } from 'react'

import { Flex } from '@pure/ui'
import NavHeader from '@/features/home/components/NavHeader'
import WideScreenContainer from '@/features/home/components/WideScreenContainer'
import HomeContent from '@/features/home/HomeContent'

const HomePage = memo(() => {
  return (
    <Flex className='flex-col flex-1 size-full min-h-[0px]'>
      <NavHeader />
      <Flex className='flex-col-center flex-1 min-h-[0px] overflow-y-auto py-6 w-full'>
        <WideScreenContainer>
          <HomeContent />
        </WideScreenContainer>
      </Flex>
      <div className='h-10'></div>
    </Flex>
  )
})

HomePage.displayName = 'HomePage'

export default HomePage
