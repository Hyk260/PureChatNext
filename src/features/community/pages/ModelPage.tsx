'use client'

import { Flex } from 'antd'
import { memo } from 'react'

import ModelList from '@/features/community/components/ModelList'
import { COMMUNITY_MODELS } from '@/const/community/models'

const ModelPage = memo(() => {
  return (
    <Flex vertical gap={32} style={{ width: '100%' }}>
      <ModelList data={COMMUNITY_MODELS} />
    </Flex>
  )
})

ModelPage.displayName = 'ModelPage'

export default ModelPage
