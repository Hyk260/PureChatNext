'use client'

import { Flexbox } from '@lobehub/ui'
import { memo } from 'react'

import HomeAgentSelect from '@/features/home/components/HomeAgentSelect'
import HomeChatInput from '@/features/home/components/HomeChatInput'
import HomeWelcomeText from '@/features/home/components/HomeWelcomeText'
// import RecommendationList from '@/features/home/components/RecommendationList'
// import StarterList from '@/features/home/components/StarterList'

const HomeContent = memo(() => {
  return (
    <Flexbox gap={40}>
      <Flexbox gap={24}>
        <Flexbox gap={8}>
          <HomeAgentSelect />
          <HomeWelcomeText />
        </Flexbox>
        <Flexbox gap={16} style={{ marginBottom: 16 }}>
          <HomeChatInput />
          {/* <StarterList /> */}
        </Flexbox>
      </Flexbox>
      {/* <RecommendationList /> */}
    </Flexbox>
  )
})

HomeContent.displayName = 'HomeContent'

export default HomeContent
