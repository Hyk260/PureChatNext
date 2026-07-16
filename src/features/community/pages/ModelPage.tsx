'use client'

import { Flexbox } from '@lobehub/ui'
import { memo } from 'react'

import ModelList from '@/features/community/components/ModelList'
import { COMMUNITY_MODELS } from '@/const/community/models'

const ModelPage = memo(() => {
  return (
    <Flexbox gap={32} width='100%'>
      <ModelList data={COMMUNITY_MODELS} />
    </Flexbox>
  )
})

ModelPage.displayName = 'ModelPage'

export default ModelPage
