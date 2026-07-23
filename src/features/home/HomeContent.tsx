'use client'

import { Flex } from 'antd'
import { memo } from 'react'

import HomeAgentSelect from '@/features/home/components/HomeAgentSelect'
import HomeChatInput from '@/features/home/components/HomeChatInput'
import HomeWelcomeText from '@/features/home/components/HomeWelcomeText'
// import RecommendationList from '@/features/home/components/RecommendationList'
// import StarterList from '@/features/home/components/StarterList'

const HomeContent = memo(() => {
  return (
    <Flex vertical gap={40}>
      <Flex vertical gap={24}>
        <Flex vertical gap={8}>
          <HomeAgentSelect />
          <HomeWelcomeText />
        </Flex>
        <Flex vertical gap={16} style={{ marginBottom: 16 }}>
          <HomeChatInput />
          {/* <StarterList /> */}
        </Flex>
      </Flex>
      {/* <RecommendationList /> */}
    </Flex>
  )
})

HomeContent.displayName = 'HomeContent'

export default HomeContent
